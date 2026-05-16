import { useRef, useState } from "react";
import { useHaptic } from "../../ui/useHaptic";

const MAX_TAGS = 3;
const MIN_CHARS = 4;
const MAX_CHARS = 25;

export interface Tag {
  value: string;
  label: string;
}

interface TagPickerProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  suggestions?: string[];
}

export function TagPicker({ value: tags, onChange, suggestions = [] }: TagPickerProps) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const haptic = useHaptic();

  const atMax = tags.length >= MAX_TAGS;
  const tagValues = tags.map((t) => t.value.toLowerCase());

  function validationError(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed.startsWith("#")) return "Без символу # на початку";
    if (trimmed.length < MIN_CHARS) return `Мінімум ${MIN_CHARS} символи`;
    if (trimmed.length > MAX_CHARS) return `Максимум ${MAX_CHARS} символів`;
    if (tagValues.includes(trimmed.toLowerCase())) return "Така послуга вже є";
    return null;
  }

  function addTag(text: string) {
    const trimmed = text.trim();
    if (validationError(trimmed)) return;
    onChange([...tags, { value: trimmed, label: trimmed }]);
    haptic.selection();
    setInputValue("");
    setInputVisible(false);
  }

  function removeTag(idx: number) {
    haptic.selection();
    onChange(tags.filter((_, i) => i !== idx));
  }

  function addSuggestion(s: string) {
    if (atMax || tagValues.includes(s.toLowerCase())) return;
    onChange([...tags, { value: s, label: s }]);
    haptic.selection();
  }

  const canAdd = !atMax && !validationError(inputValue);

  // Suggestions not yet selected and not at max
  const visibleSuggestions = suggestions.filter(
    (s) => !tagValues.includes(s.toLowerCase())
  );

  return (
    <div className="tag-picker">
      {/* Selected chips */}
      <div className="tag-picker-chips" role="listbox" aria-label="Обрані послуги">
        {tags.map((tag, i) => (
          <span key={tag.value} className="tag-chip" role="option" aria-selected="true">
            {tag.label}
            <button
              type="button"
              className="tag-chip-remove"
              aria-label={`Видалити ${tag.label}`}
              onClick={() => removeTag(i)}
            >
              ×
            </button>
          </span>
        ))}

        {/* Add button or inline input */}
        {!atMax && !inputVisible && (
          <button
            type="button"
            className="tag-chip-add"
            role="button"
            onClick={() => {
              setInputVisible(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            + Додати послугу
          </button>
        )}
      </div>

      {/* Inline input */}
      {inputVisible && (
        <div className="tag-input-row">
          <input
            ref={inputRef}
            className="tag-input"
            inputMode="text"
            maxLength={MAX_CHARS}
            placeholder="Назва послуги"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(inputValue);
              }
              if (e.key === "Escape") {
                setInputVisible(false);
                setInputValue("");
              }
            }}
          />
          <button
            type="button"
            className="tag-input-confirm"
            disabled={!canAdd}
            onClick={() => addTag(inputValue)}
          >
            Додати
          </button>
        </div>
      )}

      {/* Helper / error */}
      <p className="wizard-hint">
        {atMax
          ? "Можна вказати до 3 послуг."
          : inputVisible && inputValue.length > 0
          ? (validationError(inputValue) ?? `${inputValue.trim().length} / ${MAX_CHARS}`)
          : "Наприклад: «Заміна мастила», «Сервіс BMW», «Техогляд»."}
      </p>

      {/* Suggestions */}
      {visibleSuggestions.length > 0 && !atMax && (
        <div className="tag-suggestions">
          <span className="tag-suggestions-label">Запропоновані:</span>
          <div className="tag-suggestions-list">
            {visibleSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="tag-suggestion-chip"
                onClick={() => addSuggestion(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
