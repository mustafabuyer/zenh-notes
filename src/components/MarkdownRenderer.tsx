import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onRunScript?: (script: string) => Promise<string>;
}

function MarkdownRenderer({ content, onRunScript }: MarkdownRendererProps) {
  const [processedContent, setProcessedContent] = useState<JSX.Element[]>([]);

  useEffect(() => {
    processContent();
  }, [content]);

  const processContent = () => {
    const elements: JSX.Element[] = [];
    let key = 0;
    
    // Process code blocks first
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Process text before code block
      if (match.index > lastIndex) {
        elements.push(...parseText(content.slice(lastIndex, match.index), key++));
      }

      const language = match[1] || 'text';
      const code = match[2].trim();
      const isScript = language === 'js' || language === 'javascript';

      elements.push(
        <div key={`code-${key++}`} className="my-4 rounded-lg overflow-hidden bg-obsidian-bg-tertiary">
          <div className="flex items-center justify-between px-4 py-2 bg-obsidian-bg-secondary border-b border-obsidian-border">
            <span className="text-xs text-obsidian-text-muted">{language}</span>
            {isScript && onRunScript && (
              <button
                onClick={() => handleRunScript(code, `script-${key}`)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded transition-colors"
              >
                <Play size={12} />
                <span>Run</span>
              </button>
            )}
          </div>
          <pre className="p-3 text-sm overflow-x-auto font-mono">
            <code>{code}</code>
          </pre>
          {isScript && <div id={`script-output-${key}`} className="hidden p-3 border-t border-obsidian-border bg-obsidian-bg font-mono text-sm"></div>}
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Process remaining text
    if (lastIndex < content.length) {
      elements.push(...parseText(content.slice(lastIndex), key++));
    }

    setProcessedContent(elements);
  };

  const parseText = (text: string, baseKey: number): JSX.Element[] => {
    const elements: JSX.Element[] = [];
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
      let processedLine: JSX.Element | string = line;
      
      // Headers
      if (line.startsWith('# ')) {
        processedLine = <h1 key={`h1-${baseKey}-${index}`} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      } else if (line.startsWith('## ')) {
        processedLine = <h2 key={`h2-${baseKey}-${index}`} className="text-xl font-semibold mt-3 mb-2">{line.slice(3)}</h2>;
      } else if (line.startsWith('### ')) {
        processedLine = <h3 key={`h3-${baseKey}-${index}`} className="text-lg font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
      } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        // Task items
        const isChecked = line.includes('- [x]');
        const taskText = line.slice(6);
        processedLine = (
          <div key={`task-${baseKey}-${index}`} className="flex items-center space-x-2 my-1">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => {}}
              data-index={index}
              className="rounded cursor-pointer"
            />
            <span className={isChecked ? 'line-through text-obsidian-text-muted' : ''}>
              {processInlineFormatting(taskText)}
            </span>
          </div>
        );
      } else if (line.startsWith('- ')) {
        // Bullet points
        processedLine = (
          <li key={`li-${baseKey}-${index}`} className="ml-4 list-disc">
            {processInlineFormatting(line.slice(2))}
          </li>
        );
      } else if (line.match(/^\d+\. /)) {
        // Numbered lists
        const match = line.match(/^(\d+)\. (.*)$/);
        if (match) {
          processedLine = (
            <li key={`ol-${baseKey}-${index}`} className="ml-4 list-decimal">
              {processInlineFormatting(match[2])}
            </li>
          );
        }
      } else if (line.startsWith('> ')) {
        // Blockquotes
        processedLine = (
          <blockquote key={`quote-${baseKey}-${index}`} className="border-l-4 border-obsidian-accent pl-4 my-2 text-obsidian-text-muted">
            {processInlineFormatting(line.slice(2))}
          </blockquote>
        );
      } else {
        // Process inline elements
        let processedContent: (JSX.Element | string)[] = [];
        let remainingText = line;
        let inlineKey = 0;

        // Images
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let imageMatch;
        let lastImageIndex = 0;
        
        while ((imageMatch = imageRegex.exec(line)) !== null) {
          if (imageMatch.index > lastImageIndex) {
            processedContent.push(
              <span key={`text-${baseKey}-${index}-${inlineKey++}`}>
                {processInlineFormatting(line.slice(lastImageIndex, imageMatch.index))}
              </span>
            );
          }
          
          const imageSrc = imageMatch[2];
          
          processedContent.push(
            <img
              key={`img-${baseKey}-${index}-${inlineKey++}`}
              src={imageSrc}
              alt={imageMatch[1]}
              className="max-w-full rounded-md my-2 block"
              onError={(e) => {
                console.error('Image failed to load:', imageSrc);
                // If file:// doesn't work, try without protocol
                if (imageSrc.startsWith('file://')) {
                  (e.target as HTMLImageElement).src = imageSrc.replace('file://', '');
                }
              }}
            />
          );
          
          lastImageIndex = imageMatch.index + imageMatch[0].length;
        }
        
        if (lastImageIndex < line.length) {
          processedContent.push(
            <span key={`text-${baseKey}-${index}-${inlineKey++}`}>
              {processInlineFormatting(line.slice(lastImageIndex))}
            </span>
          );
        }
        
        processedLine = <div key={`line-${baseKey}-${index}`}>{processedContent}</div>;
      }
      
      elements.push(processedLine as JSX.Element);
    });
    
    return elements;
  };

  const processInlineFormatting = (text: string): (JSX.Element | string)[] => {
    const result: (JSX.Element | string)[] = [];
    let remaining = text;
    let key = 0;

    // Process internal links [[Note Name]]
    remaining = remaining.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
      const placeholder = `__INTERNAL_LINK_${key}__`;
      result.push(
        <a
          key={`link-${key++}`}
          href={`#internal:${linkText}`}
          className="text-obsidian-accent hover:underline cursor-pointer"
        >
          {linkText}
        </a>
      );
      return placeholder;
    });

    // Bold and italic combined
    remaining = remaining.replace(/\*\*\*(.*?)\*\*\*/g, (match, text) => {
      const placeholder = `__BOLD_ITALIC_${key}__`;
      result.push(<strong key={`bi-${key++}`} className="font-bold italic">{text}</strong>);
      return placeholder;
    });

    // Bold
    remaining = remaining.replace(/\*\*(.*?)\*\*/g, (match, text) => {
      const placeholder = `__BOLD_${key}__`;
      result.push(<strong key={`b-${key++}`} className="font-bold">{text}</strong>);
      return placeholder;
    });

    // Italic
    remaining = remaining.replace(/\*(.*?)\*/g, (match, text) => {
      const placeholder = `__ITALIC_${key}__`;
      result.push(<em key={`i-${key++}`} className="italic">{text}</em>);
      return placeholder;
    });

    // Inline code
    remaining = remaining.replace(/`([^`]+)`/g, (match, text) => {
      const placeholder = `__CODE_${key}__`;
      result.push(
        <code key={`code-${key++}`} className="px-1 py-0.5 bg-obsidian-bg-tertiary rounded text-sm font-mono">
          {text}
        </code>
      );
      return placeholder;
    });

    // Links
    remaining = remaining.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const placeholder = `__LINK_${key}__`;
      result.push(
        <a key={`a-${key++}`} href={url} target="_blank" rel="noopener noreferrer" className="text-obsidian-accent hover:underline">
          {text}
        </a>
      );
      return placeholder;
    });

    // Process remaining text and placeholders
    const parts = remaining.split(/(__|__)/);
    const finalResult: (JSX.Element | string)[] = [];
    let resultIndex = 0;

    for (const part of parts) {
      if (part.match(/^__[A-Z_]+_\d+__$/)) {
        finalResult.push(result[resultIndex++]);
      } else if (part) {
        finalResult.push(part);
      }
    }

    return finalResult;
  };

  const handleRunScript = async (script: string, outputId: string) => {
    if (!onRunScript) return;
    
    const outputElement = document.getElementById(`script-output-${outputId.split('-')[1]}`);
    if (outputElement) {
      outputElement.classList.remove('hidden');
      outputElement.textContent = 'Running...';
      
      try {
        const result = await onRunScript(script);
        outputElement.textContent = result;
      } catch (error: any) {
        outputElement.textContent = `Error: ${error.message}`;
        outputElement.classList.add('text-obsidian-error');
      }
    }
  };

  return <div className="prose prose-invert max-w-none">{processedContent}</div>;
}

export default MarkdownRenderer;