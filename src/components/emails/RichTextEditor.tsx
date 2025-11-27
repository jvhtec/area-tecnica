import { useEffect, useRef, useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./RichTextEditor.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe tu mensaje aquí...",
  minHeight = "250px",
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Configure the toolbar with essential formatting options
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link"],
        ["clean"],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const formats = [
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

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set CSS custom properties for dynamic styling
    if (wrapperRef.current) {
      wrapperRef.current.style.setProperty('--editor-min-height', minHeight);
    }
  }, [minHeight]);

  return (
    <div className="rich-text-editor-wrapper" ref={wrapperRef}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
