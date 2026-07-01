import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import "./RichTextEditor.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const EMPTY_EDITOR_HTML = "<p><br></p>";

const EDITOR_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ size: ["small", false, "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] as string[] }, { background: [] as string[] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] as string[] }],
    ["link"],
    ["clean"],
  ],
  clipboard: {
    matchVisual: false,
  },
};

const EDITOR_FORMATS = [
  "header",
  "size",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "bullet",
  "align",
  "link",
];

function normalizeEditorHtml(html: string): string {
  return html === EMPTY_EDITOR_HTML ? "" : html;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe tu mensaje aquí...",
  minHeight = "250px",
}: RichTextEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.setProperty("--editor-min-height", minHeight);
    }
  }, [minHeight]);

  useEffect(() => {
    if (!wrapperRef.current || !editorRef.current || quillRef.current) return;

    const wrapperElement = wrapperRef.current;
    const editorElement = editorRef.current;
    const quill = new Quill(editorElement, {
      theme: "snow",
      modules: EDITOR_MODULES,
      formats: EDITOR_FORMATS,
      placeholder,
    });

    quillRef.current = quill;
    if (valueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(valueRef.current, "silent");
    }

    const handleTextChange = () => {
      const nextValue = normalizeEditorHtml(quill.root.innerHTML);
      valueRef.current = nextValue;
      onChangeRef.current(nextValue);
    };

    quill.on("text-change", handleTextChange);

    return () => {
      quill.off("text-change", handleTextChange);
      quillRef.current = null;
      Array.from(wrapperElement.children).forEach((child) => {
        if (child !== editorElement && child.classList.contains("ql-toolbar")) {
          child.remove();
        }
      });
      editorElement.className = "rich-text-editor";
      editorElement.replaceChildren();
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === valueRef.current) return;

    valueRef.current = value;
    quill.clipboard.dangerouslyPasteHTML(value || "", "silent");
  }, [value]);

  return (
    <div className="rich-text-editor-wrapper" ref={wrapperRef}>
      <div ref={editorRef} className="rich-text-editor" />
    </div>
  );
}
