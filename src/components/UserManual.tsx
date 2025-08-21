import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, BookOpen, Printer } from "lucide-react";
import manualContent from "@/assets/UserManual.md?raw";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

export const UserManual = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredContent, setFilteredContent] = useState(manualContent);
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  // Extract table of contents from markdown
  useEffect(() => {
    const lines = manualContent.split('\n');
    const toc: TOCItem[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^(#{2,4})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const title = match[2];
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        toc.push({ id, title, level });
      }
    });
    
    setTocItems(toc);
  }, []);

  // Filter content based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredContent(manualContent);
      return;
    }

    const lines = manualContent.split('\n');
    const filteredLines: string[] = [];
    let includeSection = false;
    let currentSection = "";

    lines.forEach((line, index) => {
      // Check if this is a header
      if (line.match(/^#{2,4}\s+/)) {
        currentSection = line;
        includeSection = line.toLowerCase().includes(searchTerm.toLowerCase());
        if (includeSection) {
          filteredLines.push(line);
        }
      } else if (includeSection) {
        filteredLines.push(line);
      } else if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
        // Include context around matching lines
        if (currentSection && !filteredLines.includes(currentSection)) {
          filteredLines.push(currentSection);
        }
        filteredLines.push(line);
        includeSection = true;
      }
    });

    setFilteredContent(filteredLines.join('\n'));
  }, [searchTerm]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar with TOC and Search */}
        <div className="lg:w-80 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                User Manual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search manual..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Print Button */}
              <Button onClick={handlePrint} variant="outline" className="w-full">
                <Printer className="w-4 h-4 mr-2" />
                Print Manual
              </Button>

              {/* Table of Contents */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Table of Contents
                </h3>
                <nav className="space-y-1 max-h-96 overflow-y-auto">
                  {tocItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left px-2 py-1 text-sm rounded hover:bg-muted transition-colors ${
                        item.level === 2 
                          ? "font-medium text-foreground" 
                          : item.level === 3
                          ? "text-muted-foreground ml-4"
                          : "text-muted-foreground ml-8 text-xs"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </nav>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-8">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    rehypeSlug,
                    [rehypeAutolinkHeadings, { behavior: 'wrap' }]
                  ]}
                  components={{
                    h2: ({ children, ...props }) => (
                      <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground border-b border-border pb-2" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground" {...props}>
                        {children}
                      </h3>
                    ),
                    h4: ({ children, ...props }) => (
                      <h4 className="text-lg font-medium mt-4 mb-2 text-foreground" {...props}>
                        {children}
                      </h4>
                    ),
                    p: ({ children, ...props }) => (
                      <p className="mb-4 leading-7 text-foreground" {...props}>
                        {children}
                      </p>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul className="mb-4 ml-6 list-disc text-foreground" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol className="mb-4 ml-6 list-decimal text-foreground" {...props}>
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="mb-2" {...props}>
                        {children}
                      </li>
                    ),
                    strong: ({ children, ...props }) => (
                      <strong className="font-semibold text-foreground" {...props}>
                        {children}
                      </strong>
                    ),
                    code: ({ children, ...props }) => (
                      <code className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-sm" {...props}>
                        {children}
                      </code>
                    )
                  }}
                >
                  {filteredContent}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};