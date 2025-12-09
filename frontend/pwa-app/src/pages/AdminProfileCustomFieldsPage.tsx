import React, { useEffect, useState, useCallback } from "react";
import {
  getProfileCustomFieldSchema,
  saveProfileCustomFieldSchema,
  ProfileCustomFieldSchema,
  CustomFieldDefinition,
  CustomFieldGroup,
  CustomFieldOption,
  CustomFieldCondition,
  CustomFieldType,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
} from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { FormField } from "../components/primitives/FormField";
import { Tag } from "../components/primitives/Tag";
import { Modal } from "../components/ui/Modal";

// Generate a unique ID for new items
const generateId = () => `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface GroupFormState {
  id: string;
  label: string;
  description: string;
  order: number;
}

interface FieldFormState {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  helpText: string;
  groupId: string;
  order: number;
  options: CustomFieldOption[];
  validation: {
    required: boolean;
    minLength: string;
    maxLength: string;
    min: string;
    max: string;
    pattern: string;
  };
  visibleWhen: CustomFieldCondition[];
}

const emptyGroupForm = (): GroupFormState => ({
  id: generateId(),
  label: "",
  description: "",
  order: 0,
});

const emptyFieldForm = (): FieldFormState => ({
  id: generateId(),
  key: "",
  label: "",
  type: "text",
  helpText: "",
  groupId: "",
  order: 0,
  options: [],
  validation: {
    required: false,
    minLength: "",
    maxLength: "",
    min: "",
    max: "",
    pattern: "",
  },
  visibleWhen: [],
});

export const AdminProfileCustomFieldsPage: React.FC = () => {
  const { tokens } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Schema state
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());

  // Modal states
  const [groupModal, setGroupModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
    data: GroupFormState;
  }>({ open: false, mode: "add", data: emptyGroupForm() });

  const [fieldModal, setFieldModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
    data: FieldFormState;
  }>({ open: false, mode: "add", data: emptyFieldForm() });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "group" | "field";
    id: string;
    label: string;
  } | null>(null);

  // Load schema
  const loadSchema = useCallback(async () => {
    if (!tokens?.access_token) return;
    setLoading(true);
    try {
      const schema = await getProfileCustomFieldSchema(tokens.access_token);
      setGroups(schema.groups || []);
      setFields(schema.fields || []);
      setUpdatedAt(schema.updatedAt);
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to load schema", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  // Save schema
  const handleSave = async () => {
    if (!tokens?.access_token) return;
    setSaving(true);
    try {
      const schema = await saveProfileCustomFieldSchema(tokens.access_token, { groups, fields });
      setGroups(schema.groups);
      setFields(schema.fields);
      setUpdatedAt(schema.updatedAt);
      setToast({ msg: "Schema saved successfully", type: "success" });
    } catch (err: any) {
      const errorMsg = err?.error?.errors
        ? Object.values(err.error.errors).join(", ")
        : err?.message || "Failed to save schema";
      setToast({ msg: errorMsg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Group handlers
  const openAddGroup = () => {
    setGroupModal({
      open: true,
      mode: "add",
      data: { ...emptyGroupForm(), order: groups.length },
    });
  };

  const openEditGroup = (group: CustomFieldGroup) => {
    setGroupModal({
      open: true,
      mode: "edit",
      data: {
        id: group.id,
        label: group.label,
        description: group.description || "",
        order: group.order ?? 0,
      },
    });
  };

  const handleSaveGroup = () => {
    const { mode, data } = groupModal;
    if (!data.label.trim()) {
      setToast({ msg: "Group label is required", type: "error" });
      return;
    }

    if (mode === "add") {
      setGroups([...groups, { id: data.id, label: data.label, description: data.description || undefined, order: data.order }]);
    } else {
      setGroups(groups.map((g) => (g.id === data.id ? { ...g, label: data.label, description: data.description || undefined, order: data.order } : g)));
    }
    setGroupModal({ ...groupModal, open: false });
  };

  const handleDeleteGroup = (groupId: string) => {
    const fieldsInGroup = fields.filter((f) => f.groupId === groupId);
    if (fieldsInGroup.length > 0) {
      setToast({ msg: "Cannot delete group with fields. Remove fields first.", type: "error" });
      return;
    }
    setGroups(groups.filter((g) => g.id !== groupId));
    setDeleteConfirm(null);
  };

  // Field handlers
  const openAddField = () => {
    setFieldModal({
      open: true,
      mode: "add",
      data: { ...emptyFieldForm(), order: fields.length },
    });
  };

  const openEditField = (field: CustomFieldDefinition) => {
    setFieldModal({
      open: true,
      mode: "edit",
      data: {
        id: field.id,
        key: field.key,
        label: field.label,
        type: field.type,
        helpText: field.helpText || "",
        groupId: field.groupId || "",
        order: field.order ?? 0,
        options: field.options || [],
        validation: {
          required: field.validation?.required || false,
          minLength: field.validation?.minLength?.toString() || "",
          maxLength: field.validation?.maxLength?.toString() || "",
          min: field.validation?.min?.toString() || "",
          max: field.validation?.max?.toString() || "",
          pattern: field.validation?.pattern || "",
        },
        visibleWhen: field.visibleWhen || [],
      },
    });
  };

  const handleSaveField = () => {
    const { mode, data } = fieldModal;

    // Validation
    if (!data.key.trim()) {
      setToast({ msg: "Field key is required", type: "error" });
      return;
    }
    if (!data.label.trim()) {
      setToast({ msg: "Field label is required", type: "error" });
      return;
    }

    // Check for duplicate keys
    const existingField = fields.find((f) => f.key === data.key && f.id !== data.id);
    if (existingField) {
      setToast({ msg: "Field key must be unique", type: "error" });
      return;
    }

    // Build the field definition
    const fieldDef: CustomFieldDefinition = {
      id: data.id,
      key: data.key.trim(),
      label: data.label.trim(),
      type: data.type,
      helpText: data.helpText || undefined,
      groupId: data.groupId || undefined,
      order: data.order,
      options: (data.type === "select" || data.type === "checkbox") ? data.options.filter((o) => o.value && o.label) : undefined,
      validation: {
        required: data.validation.required || undefined,
        minLength: data.validation.minLength ? parseInt(data.validation.minLength) : undefined,
        maxLength: data.validation.maxLength ? parseInt(data.validation.maxLength) : undefined,
        min: data.validation.min ? parseFloat(data.validation.min) : undefined,
        max: data.validation.max ? parseFloat(data.validation.max) : undefined,
        pattern: data.validation.pattern || undefined,
      },
      visibleWhen: data.visibleWhen.length > 0 ? data.visibleWhen : undefined,
    };

    // Clean up undefined values from validation
    if (fieldDef.validation) {
      fieldDef.validation = Object.fromEntries(
        Object.entries(fieldDef.validation).filter(([_, v]) => v !== undefined)
      ) as typeof fieldDef.validation;
      if (Object.keys(fieldDef.validation).length === 0) {
        fieldDef.validation = undefined;
      }
    }

    if (mode === "add") {
      setFields([...fields, fieldDef]);
    } else {
      setFields(fields.map((f) => (f.id === data.id ? fieldDef : f)));
    }
    setFieldModal({ ...fieldModal, open: false });
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
    setDeleteConfirm(null);
  };

  // Option handlers for select/checkbox fields
  const addOption = () => {
    setFieldModal({
      ...fieldModal,
      data: {
        ...fieldModal.data,
        options: [...fieldModal.data.options, { value: "", label: "" }],
      },
    });
  };

  const updateOption = (index: number, key: "value" | "label", value: string) => {
    const newOptions = [...fieldModal.data.options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    setFieldModal({
      ...fieldModal,
      data: { ...fieldModal.data, options: newOptions },
    });
  };

  const removeOption = (index: number) => {
    setFieldModal({
      ...fieldModal,
      data: {
        ...fieldModal.data,
        options: fieldModal.data.options.filter((_, i) => i !== index),
      },
    });
  };

  // Condition handlers
  const addCondition = () => {
    setFieldModal({
      ...fieldModal,
      data: {
        ...fieldModal.data,
        visibleWhen: [...fieldModal.data.visibleWhen, { fieldId: "", equals: "" }],
      },
    });
  };

  const updateCondition = (index: number, key: keyof CustomFieldCondition, value: string) => {
    const newConditions = [...fieldModal.data.visibleWhen];
    newConditions[index] = { ...newConditions[index], [key]: value };
    setFieldModal({
      ...fieldModal,
      data: { ...fieldModal.data, visibleWhen: newConditions },
    });
  };

  const removeCondition = (index: number) => {
    setFieldModal({
      ...fieldModal,
      data: {
        ...fieldModal.data,
        visibleWhen: fieldModal.data.visibleWhen.filter((_, i) => i !== index),
      },
    });
  };

  // Sort groups and fields by order
  const sortedGroups = [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (loading) {
    return (
      <Page title="Profile Custom Fields" description="Define additional fields to collect from members.">
        <Card>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
            Loading schema...
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Profile Custom Fields" description="Define additional fields to collect from members.">
      {/* Header actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <Button onClick={handleSave} disabled={saving} loading={saving}>
          Save Schema
        </Button>
      </div>

      {/* Groups Section */}
      <Card title="Field Groups" actions={<Button size="sm" onClick={openAddGroup}>Add Group</Button>}>
        {sortedGroups.length === 0 ? (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
            No groups defined. Fields without a group will appear in "Other Information".
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {sortedGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3)",
                  background: "var(--app-color-surface-1)",
                  borderRadius: "var(--radius-medium)",
                  border: "1px solid var(--app-color-border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontWeight: "var(--font-weight-medium)" }}>{group.label}</div>
                  {group.description && (
                    <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)" }}>
                      {group.description}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button size="sm" variant="ghost" onClick={() => openEditGroup(group)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirm({ open: true, type: "group", id: group.id, label: group.label })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fields Section */}
      <div style={{ marginTop: "var(--space-6)" }}>
        <Card title="Custom Fields" actions={<Button size="sm" onClick={openAddField}>Add Field</Button>}>
          {sortedFields.length === 0 ? (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              No custom fields defined yet. Add fields to collect additional information from members.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {sortedFields.map((field) => {
                const group = groups.find((g) => g.id === field.groupId);
                return (
                  <div
                    key={field.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "var(--space-3)",
                      background: "var(--app-color-surface-1)",
                      borderRadius: "var(--radius-medium)",
                      border: "1px solid var(--app-color-border-subtle)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ fontWeight: "var(--font-weight-medium)" }}>{field.label}</span>
                        <Tag size="sm" variant="default">{CUSTOM_FIELD_TYPE_LABELS[field.type]}</Tag>
                        {field.validation?.required && <Tag size="sm" variant="warning">Required</Tag>}
                      </div>
                      <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)", marginTop: "var(--space-1)" }}>
                        Key: <code style={{ background: "var(--app-color-surface-2)", padding: "0 var(--space-1)", borderRadius: "var(--radius-small)" }}>{field.key}</code>
                        {group && <span> • Group: {group.label}</span>}
                        {field.helpText && <span> • {field.helpText}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Button size="sm" variant="ghost" onClick={() => openEditField(field)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm({ open: true, type: "field", id: field.id, label: field.label })}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Group Modal */}
      <Modal
        open={groupModal.open}
        onClose={() => setGroupModal({ ...groupModal, open: false })}
        title={groupModal.mode === "add" ? "Add Field Group" : "Edit Field Group"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGroupModal({ ...groupModal, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup}>
              {groupModal.mode === "add" ? "Add Group" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <FormField label="Label" required>
            <input
              className="pr-input"
              value={groupModal.data.label}
              onChange={(e) => setGroupModal({ ...groupModal, data: { ...groupModal.data, label: e.target.value } })}
              placeholder="e.g., Professional Information"
            />
          </FormField>
          <FormField label="Description">
            <textarea
              className="pr-input"
              value={groupModal.data.description}
              onChange={(e) => setGroupModal({ ...groupModal, data: { ...groupModal.data, description: e.target.value } })}
              placeholder="Optional description for this group"
              rows={2}
            />
          </FormField>
          <FormField label="Order">
            <input
              type="number"
              className="pr-input"
              value={groupModal.data.order}
              onChange={(e) => setGroupModal({ ...groupModal, data: { ...groupModal.data, order: parseInt(e.target.value) || 0 } })}
            />
          </FormField>
        </div>
      </Modal>

      {/* Field Modal */}
      <Modal
        open={fieldModal.open}
        onClose={() => setFieldModal({ ...fieldModal, open: false })}
        title={fieldModal.mode === "add" ? "Add Custom Field" : "Edit Custom Field"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFieldModal({ ...fieldModal, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleSaveField}>
              {fieldModal.mode === "add" ? "Add Field" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxHeight: "60vh", overflow: "auto" }}>
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <FormField label="Key" required>
              <input
                className="pr-input"
                value={fieldModal.data.key}
                onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, key: e.target.value.replace(/\s/g, "_").toLowerCase() } })}
                placeholder="e.g., company_name"
                disabled={fieldModal.mode === "edit"}
              />
            </FormField>
            <FormField label="Label" required>
              <input
                className="pr-input"
                value={fieldModal.data.label}
                onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, label: e.target.value } })}
                placeholder="e.g., Company Name"
              />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <FormField label="Type" required>
              <select
                className="pr-input"
                value={fieldModal.data.type}
                onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, type: e.target.value as CustomFieldType } })}
              >
                {CUSTOM_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>{CUSTOM_FIELD_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Group">
              <select
                className="pr-input"
                value={fieldModal.data.groupId}
                onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, groupId: e.target.value } })}
              >
                <option value="">No Group (Other Information)</option>
                {sortedGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.label}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Help Text">
            <input
              className="pr-input"
              value={fieldModal.data.helpText}
              onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, helpText: e.target.value } })}
              placeholder="Optional help text shown below the field"
            />
          </FormField>

          <FormField label="Order">
            <input
              type="number"
              className="pr-input"
              value={fieldModal.data.order}
              onChange={(e) => setFieldModal({ ...fieldModal, data: { ...fieldModal.data, order: parseInt(e.target.value) || 0 } })}
              style={{ maxWidth: 100 }}
            />
          </FormField>

          {/* Options for select/checkbox */}
          {(fieldModal.data.type === "select" || fieldModal.data.type === "checkbox") && (
            <div style={{ padding: "var(--space-3)", background: "var(--app-color-surface-1)", borderRadius: "var(--radius-medium)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <span style={{ fontWeight: "var(--font-weight-medium)" }}>Options</span>
                <Button size="sm" variant="secondary" onClick={addOption}>Add Option</Button>
              </div>
              {fieldModal.data.options.length === 0 ? (
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--font-caption)" }}>
                  No options defined. Add at least one option.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {fieldModal.data.options.map((opt, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <input
                        className="pr-input"
                        value={opt.value}
                        onChange={(e) => updateOption(idx, "value", e.target.value)}
                        placeholder="Value"
                        style={{ flex: 1 }}
                      />
                      <input
                        className="pr-input"
                        value={opt.label}
                        onChange={(e) => updateOption(idx, "label", e.target.value)}
                        placeholder="Label"
                        style={{ flex: 1 }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => removeOption(idx)}>×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation */}
          <div style={{ padding: "var(--space-3)", background: "var(--app-color-surface-1)", borderRadius: "var(--radius-medium)" }}>
            <div style={{ fontWeight: "var(--font-weight-medium)", marginBottom: "var(--space-3)" }}>Validation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <input
                  type="checkbox"
                  checked={fieldModal.data.validation.required}
                  onChange={(e) =>
                    setFieldModal({
                      ...fieldModal,
                      data: {
                        ...fieldModal.data,
                        validation: { ...fieldModal.data.validation, required: e.target.checked },
                      },
                    })
                  }
                />
                Required field
              </label>

              {(fieldModal.data.type === "text" || fieldModal.data.type === "textarea") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <FormField label="Min Length">
                    <input
                      type="number"
                      className="pr-input"
                      value={fieldModal.data.validation.minLength}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: {
                            ...fieldModal.data,
                            validation: { ...fieldModal.data.validation, minLength: e.target.value },
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Max Length">
                    <input
                      type="number"
                      className="pr-input"
                      value={fieldModal.data.validation.maxLength}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: {
                            ...fieldModal.data,
                            validation: { ...fieldModal.data.validation, maxLength: e.target.value },
                          },
                        })
                      }
                    />
                  </FormField>
                </div>
              )}

              {fieldModal.data.type === "number" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <FormField label="Minimum Value">
                    <input
                      type="number"
                      className="pr-input"
                      value={fieldModal.data.validation.min}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: {
                            ...fieldModal.data,
                            validation: { ...fieldModal.data.validation, min: e.target.value },
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Maximum Value">
                    <input
                      type="number"
                      className="pr-input"
                      value={fieldModal.data.validation.max}
                      onChange={(e) =>
                        setFieldModal({
                          ...fieldModal,
                          data: {
                            ...fieldModal.data,
                            validation: { ...fieldModal.data.validation, max: e.target.value },
                          },
                        })
                      }
                    />
                  </FormField>
                </div>
              )}

              {(fieldModal.data.type === "text" || fieldModal.data.type === "textarea") && (
                <FormField label="Pattern (Regex)">
                  <input
                    className="pr-input"
                    value={fieldModal.data.validation.pattern}
                    onChange={(e) =>
                      setFieldModal({
                        ...fieldModal,
                        data: {
                          ...fieldModal.data,
                          validation: { ...fieldModal.data.validation, pattern: e.target.value },
                        },
                      })
                    }
                    placeholder="e.g., ^[A-Z].* (starts with capital letter)"
                  />
                </FormField>
              )}
            </div>
          </div>

          {/* Conditional Visibility */}
          <div style={{ padding: "var(--space-3)", background: "var(--app-color-surface-1)", borderRadius: "var(--radius-medium)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <span style={{ fontWeight: "var(--font-weight-medium)" }}>Conditional Visibility</span>
              <Button size="sm" variant="secondary" onClick={addCondition}>Add Condition</Button>
            </div>
            {fieldModal.data.visibleWhen.length === 0 ? (
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--font-caption)" }}>
                No conditions. Field will always be visible.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ fontSize: "var(--font-caption)", color: "var(--app-color-text-muted)" }}>
                  Show this field only when ALL conditions are met:
                </div>
                {fieldModal.data.visibleWhen.map((cond, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <select
                      className="pr-input"
                      value={cond.fieldId}
                      onChange={(e) => updateCondition(idx, "fieldId", e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select field...</option>
                      {fields.filter((f) => f.id !== fieldModal.data.id).map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                    <span style={{ color: "var(--app-color-text-muted)" }}>equals</span>
                    <input
                      className="pr-input"
                      value={String(cond.equals || "")}
                      onChange={(e) => updateCondition(idx, "equals", e.target.value)}
                      placeholder="Value"
                      style={{ flex: 1 }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeCondition(idx)}>×</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          open={deleteConfirm.open}
          onClose={() => setDeleteConfirm(null)}
          title={`Delete ${deleteConfirm.type === "group" ? "Group" : "Field"}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() =>
                  deleteConfirm.type === "group"
                    ? handleDeleteGroup(deleteConfirm.id)
                    : handleDeleteField(deleteConfirm.id)
                }
              >
                Delete
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete "{deleteConfirm.label}"? This action cannot be undone.</p>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

export default AdminProfileCustomFieldsPage;

