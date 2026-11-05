"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type ThemeSelectOption = {
  value: string;
  label: string;
};

type ThemeSelectProps = {
  value: string;
  options: ThemeSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

function indexForValue(options: ThemeSelectOption[], value: string) {
  const idx = options.findIndex((o) => o.value === value);
  return idx >= 0 ? idx : 0;
}

export function ThemeSelect({
  value,
  options,
  onChange,
  placeholder = "اختر…",
  required = false,
  disabled = false,
  id,
  name,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ThemeSelectProps) {
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const triggerId = id ?? `${autoId}-trigger`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => indexForValue(options, value));

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActiveIndex(indexForValue(options, value));
    setOpen(true);
  }, [disabled, options, value]);

  const selectAt = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      setActiveIndex(index);
      setOpen(false);
    },
    [onChange, options],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-index="${activeIndex}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, activeIndex]);

  function moveActive(delta: number) {
    if (options.length === 0) return;
    setActiveIndex((prev) => (prev + delta + options.length) % options.length);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openMenu();
        else moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openMenu();
        else moveActive(-1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) selectAt(activeIndex);
        else openMenu();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      default:
        break;
    }
  }

  const invalid =
    ariaInvalid === true || ariaInvalid === "true"
      ? true
      : ariaInvalid === false || ariaInvalid === "false"
        ? false
        : undefined;

  return (
    <div
      ref={rootRef}
      className={`theme-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${
        invalid ? " is-invalid" : ""
      }`}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={triggerId}
        className="theme-select__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="none"
        aria-activedescendant={open ? `${autoId}-opt-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        data-required={required || undefined}
        data-invalid={invalid || undefined}
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={
            selected ? "theme-select__value" : "theme-select__value is-placeholder"
          }
        >
          {displayLabel}
        </span>
        <span className="theme-select__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          className="theme-select__list"
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={-1}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={`${option.value}-${index}`}
                id={`${autoId}-opt-${index}`}
                role="option"
                data-index={index}
                aria-selected={isSelected}
                className={`theme-select__option${isSelected ? " is-selected" : ""}${
                  isActive ? " is-active" : ""
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAt(index);
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
