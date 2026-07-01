import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RichTextEditor } from "../RichTextEditor";

type PasteCall = {
  html: string;
  source: string;
};

type TextChangeHandler = () => void;

const { mockQuillInstances, MockQuill } = vi.hoisted(() => {
  class MockQuillClass {
    root = { innerHTML: "" };
    handlers = new Map<string, TextChangeHandler>();
    pasteCalls: PasteCall[] = [];
    options: Record<string, unknown>;
    element: Element;

    clipboard = {
      dangerouslyPasteHTML: (html: string, source: string) => {
        this.pasteCalls.push({ html, source });
        this.root.innerHTML = html || "<p><br></p>";
      },
    };

    constructor(element: Element, options: Record<string, unknown>) {
      this.element = element;
      this.options = options;
      element.classList.add("ql-container");

      const toolbar = document.createElement("div");
      toolbar.className = "ql-toolbar";
      element.parentElement?.insertBefore(toolbar, element);

      instances.push(this);
    }

    on(event: string, handler: TextChangeHandler) {
      this.handlers.set(event, handler);
    }

    off(event: string, handler: TextChangeHandler) {
      if (this.handlers.get(event) === handler) {
        this.handlers.delete(event);
      }
    }
  }

  const instances: MockQuillClass[] = [];

  return {
    mockQuillInstances: instances,
    MockQuill: MockQuillClass,
  };
});

vi.mock("quill", () => ({
  default: MockQuill,
}));

describe("RichTextEditor", () => {
  beforeEach(() => {
    mockQuillInstances.length = 0;
  });

  it("initializes Quill with the supplied value and emits user edits", () => {
    const onChange = vi.fn();

    render(
      <RichTextEditor
        value="<p>Hello</p>"
        onChange={onChange}
        placeholder="Body"
      />,
    );

    const editor = mockQuillInstances[0];
    expect(editor.options).toMatchObject({
      theme: "snow",
      placeholder: "Body",
    });
    expect(editor.pasteCalls).toEqual([
      { html: "<p>Hello</p>", source: "silent" },
    ]);

    act(() => {
      editor.root.innerHTML = "<p>Updated</p>";
      editor.handlers.get("text-change")?.();
    });

    expect(onChange).toHaveBeenLastCalledWith("<p>Updated</p>");
  });

  it("syncs external value changes and normalizes empty Quill HTML", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextEditor value="" onChange={onChange} />,
    );
    const editor = mockQuillInstances[0];

    rerender(<RichTextEditor value="<p>External</p>" onChange={onChange} />);

    expect(editor.pasteCalls).toEqual([
      { html: "<p>External</p>", source: "silent" },
    ]);
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      editor.root.innerHTML = "<p><br></p>";
      editor.handlers.get("text-change")?.();
    });

    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
