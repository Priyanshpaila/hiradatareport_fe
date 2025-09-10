import { Input, InputNumber, DatePicker, Select, Switch } from "antd";
import dayjs from "dayjs";

/**
 * FormField
 * - Works inside <Form.Item name="..."> with default mapping (value/onChange)
 * - Accepts: { schema, uiSchema, name, value, onChange, disabled, autoFocus }
 */
export default function FormField({
  schema,
  uiSchema = {},
  name, // not used here but kept for parity
  value,
  onChange,
  disabled,
  autoFocus,
}) {
  const t = schema?.type;
  const placeholder =
    uiSchema["ui:placeholder"] || schema?.description || undefined;

  /* ---------- helpers ---------- */
  const emit = (v) => onChange?.(v === null ? undefined : v);

  /* ---------- number / integer ---------- */
  if (t === "number" || t === "integer") {
    const isInt = t === "integer";
    const min = schema?.minimum;
    const max = schema?.maximum;

    // Strict parser (blocks letters, allows one dot for number)
    const parser = (raw) => {
      if (raw === undefined || raw === null) return "";
      const str = String(raw);
      return isInt
        ? str.replace(/[^\d-]/g, "")              // only digits and minus
        : str.replace(/[^\d.-]/g, "");            // digits, dot, minus
    };

    return (
      <InputNumber
        style={{ width: "100%" }}
        value={typeof value === "number" ? value : undefined}
        onChange={(v) => {
          if (v === null || v === undefined || v === "") return emit(undefined);
          // Ensure integers stay integers
          emit(isInt ? Math.trunc(Number(v)) : Number(v));
        }}
        parser={parser}
        precision={isInt ? 0 : undefined}
        step={isInt ? 1 : 0.01}
        min={typeof min === "number" ? min : undefined}
        max={typeof max === "number" ? max : undefined}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  /* ---------- date (string with format=date) ---------- */
  if (t === "string" && schema?.format === "date") {
    const d = typeof value === "string" ? dayjs(value) : null;
    const pickerVal = d && d.isValid() ? d : null;
    return (
      <DatePicker
        style={{ width: "100%" }}
        value={pickerVal}
        onChange={(day) => emit(day ? day.format("YYYY-MM-DD") : undefined)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  /* ---------- enum (dropdown) ---------- */
  if (t === "string" && Array.isArray(schema?.enum)) {
    const options = schema.enum.map((v) => ({ label: String(v), value: v }));
    return (
      <Select
        style={{ width: "100%" }}
        value={value ?? undefined}
        onChange={(v) => emit(v)}
        options={options}
        allowClear
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  /* ---------- boolean ---------- */
  if (t === "boolean") {
    // Map form "value" to Switch "checked" under the hood
    return (
      <Switch
        checked={!!value}
        onChange={(checked) => emit(!!checked)}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  /* ---------- strings (default / textarea / email / password) ---------- */
  if (t === "string") {
    const isTextarea = uiSchema["ui:widget"] === "textarea";
    const rows =
      (uiSchema["ui:options"] && uiSchema["ui:options"].rows) || 3;
    const inputProps = {
      value: value ?? "",
      onChange: (e) => {
        const v = e?.target?.value;
        emit(v ? v : undefined);
      },
      placeholder,
      disabled,
      autoFocus,
      maxLength: schema?.maxLength,
    };

    if (isTextarea) return <Input.TextArea {...inputProps} rows={rows} />;
    if (schema?.format === "email")
      return <Input {...inputProps} type="email" inputMode="email" />;
    if (uiSchema["ui:widget"] === "password")
      return <Input.Password {...inputProps} />;

    return <Input {...inputProps} />;
  }

  /* ---------- fallback ---------- */
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => emit(e?.target?.value || undefined)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}
