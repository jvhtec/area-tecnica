/**
 * ShortcutKeybindEditor
 *
 * A component that allows users to edit keyboard shortcuts by clicking
 * and pressing the desired key combination.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Edit2, Check } from 'lucide-react';

interface ShortcutKeybindEditorProps {
  currentKeybind?: string;
  onSave: (keybind: string) => void;
  onCancel?: () => void;
}

export function ShortcutKeybindEditor({ currentKeybind, onSave, onCancel }: ShortcutKeybindEditorProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRecording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier keys alone
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    // Build keybind string
    const parts: string[] = [];

    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Handle special keys
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();

    parts.push(key);

    const keybind = parts.join('+');
    setRecordedKeys(keybind);
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordedKeys('');
  };

  const handleSave = () => {
    if (recordedKeys) {
      onSave(recordedKeys);
      setIsRecording(false);
      setRecordedKeys('');
    }
  };

  const handleCancel = () => {
    setIsRecording(false);
    setRecordedKeys('');
    onCancel?.();
  };

  if (!isRecording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          {currentKeybind ? (
            <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono border">
              {currentKeybind}
            </kbd>
          ) : (
            <span className="text-sm text-muted-foreground italic">No keybind</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleStartRecording}
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Button>
        {currentKeybind && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSave('')}
            title="Clear keybind"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        value={recordedKeys || 'Press keys...'}
        onKeyDown={handleKeyDown}
        readOnly
        className="flex-1 font-mono text-sm"
        placeholder="Press a key combination"
      />
      <Button
        size="sm"
        variant="default"
        onClick={handleSave}
        disabled={!recordedKeys}
      >
        <Check className="h-3 w-3 mr-1" />
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
