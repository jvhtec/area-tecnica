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

  useEffect(() => {
    // Set custom styles for the editor container
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const editorContainer = editor.root;
      editorContainer.style.minHeight = minHeight;
      editorContainer.style.fontSize = "14px";
      editorContainer.style.fontFamily = "Arial, Helvetica, sans-serif";
    }
  }, [minHeight]);

  return (
    <div className="rich-text-editor-wrapper">
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
