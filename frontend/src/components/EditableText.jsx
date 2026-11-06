import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';

export function EditableText({
  textKey,
  isEditMode,
  texts,
  onUpdateText,
  tag = 'span',
  className = ''
}) {
  const value = texts[textKey] || '';
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (draft.trim() !== value) {
      onUpdateText(textKey, draft.trim() || value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setIsEditing(false);
    }
  };

  const Tag = tag;

  if (isEditMode) {
    if (isEditing) {
      return (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`editable-input-active ${className}`}
        />
      );
    }

    return (
      <Tag
        onClick={() => setIsEditing(true)}
        className={`editable-text-field ${className}`}
        title="Clic para editar este texto antes de proyectar"
      >
        <span>{value}</span>
        <Pencil size={13} className="editable-pencil-icon" />
      </Tag>
    );
  }

  return <Tag className={className}>{value}</Tag>;
}
