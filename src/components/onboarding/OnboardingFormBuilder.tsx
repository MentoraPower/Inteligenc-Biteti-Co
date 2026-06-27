import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  X,
  Eye,
  MoreVertical,
  Hash,
  Save,
  FileDown,
} from "lucide-react";
import { FormTemplateDialog } from "./FormTemplateDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnboardingPreview } from "./OnboardingPreview";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  is_active: boolean;
  is_published: boolean;
  published_at: string | null;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any;
  is_required: boolean;
  ordem: number;
}

interface OnboardingFormBuilderProps {
  form: OnboardingForm;
  fields: OnboardingField[];
  onClose: () => void;
  onUpdate: () => void;
}

const FIELD_TYPES = [
  { id: "text_short", label: "Texto Curto", icon: Type },
  { id: "text_long", label: "Texto Longo", icon: AlignLeft },
  { id: "number", label: "Número (R$)", icon: Hash },
  { id: "dropdown", label: "Menu Suspenso", icon: ChevronDown },
  { id: "checkbox", label: "Caixa de Seleção", icon: CheckSquare },
];

interface SortableFieldCardProps {
  field: OnboardingField;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onUpdate: (updates: Partial<OnboardingField>) => void;
  onDelete: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onRemoveOption: (optionIndex: number) => void;
  onChangeFieldType: (newType: string) => void;
  getFieldIcon: (type: string) => any;
  getFieldLabel: (type: string) => string;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function SortableFieldCard({
  field,
  isEditing,
  onEdit,
  onClose,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onChangeFieldType,
  getFieldIcon,
  getFieldLabel,
  isDragging = false,
  isOverlay = false,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: field.id, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined, // No transition for smooth movement
  };

  const Icon = getFieldIcon(field.field_type);

  return (
    <Card
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "shadow-none transition-none border-[#00000010]",
        isDragging && !isOverlay && "opacity-30 border-dashed border-muted-foreground/30 bg-muted/10",
        isOverlay && "shadow-2xl border-border bg-background"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 pt-1">
            <div
              {...(isOverlay ? {} : attributes)}
              {...(isOverlay ? {} : listeners)}
              className={cn(
                "p-1 -m-1 rounded cursor-grab active:cursor-grabbing touch-none",
                isOverlay ? "opacity-100" : "opacity-50 hover:opacity-100"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {isEditing && !isOverlay ? (
              <>
                <Input
                  value={field.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="Título da pergunta"
                  className="font-medium"
                />
                <Textarea
                  value={field.description || ""}
                  onChange={(e) =>
                    onUpdate({ description: e.target.value || null })
                  }
                  placeholder="Descrição (opcional)"
                  className="resize-none min-h-[60px]"
                />

                {/* Options for dropdown, checkbox, radio */}
                {["dropdown", "checkbox", "radio"].includes(field.field_type) && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Opções</Label>
                    {field.options?.map((option: string, optIndex: number) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                          placeholder={`Opção ${optIndex + 1}`}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onRemoveOption(optIndex)}
                          disabled={(field.options?.length || 0) <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddOption}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar opção
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.is_required}
                    onCheckedChange={(checked) =>
                      onUpdate({ is_required: checked })
                    }
                  />
                  <Label className="text-xs">Obrigatório</Label>
                </div>
              </>
            ) : (
              <button
                onClick={isOverlay ? undefined : onEdit}
                className="text-left w-full"
              >
                <p className="font-medium">{field.title}</p>
                {field.description && (
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {getFieldLabel(field.field_type)}
                  {field.is_required && " • Obrigatório"}
                </p>
              </button>
            )}
          </div>

          {!isOverlay && (
            <div className="flex items-center gap-1">
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  Fechar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Alterar tipo para:
                  </div>
                  {FIELD_TYPES.filter(t => t.id !== field.field_type).map((type) => (
                    <DropdownMenuItem
                      key={type.id}
                      onClick={() => onChangeFieldType(type.id)}
                      className="cursor-pointer"
                    >
                      <type.icon className="h-4 w-4 mr-2" />
                      {type.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OnboardingFormBuilder({
  form,
  fields: initialFields,
  onClose,
  onUpdate,
}: OnboardingFormBuilderProps) {
  const [isSequential, setIsSequential] = useState(form.is_sequential);
  const [fields, setFields] = useState<OnboardingField[]>(initialFields);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<"save" | "load">("save");

  // Sync local state with props
  useEffect(() => {
    const sorted = [...initialFields].sort((a, b) => a.ordem - b.ordem);
    setFields(sorted);
  }, [initialFields]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeField = activeId ? fields.find(f => f.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newFields = arrayMove(fields, oldIndex, newIndex);
    setFields(newFields);

    // Background database update
    try {
      const updates = newFields.map((field, index) => ({
        id: field.id,
        ordem: index,
      }));

      await Promise.all(
        updates.map((update) =>
          supabase
            .from("lead_onboarding_fields")
            .update({ ordem: update.ordem })
            .eq("id", update.id)
        )
      );
    } catch (error) {
      // Revert on error
      setFields([...initialFields].sort((a, b) => a.ordem - b.ordem));
      toast.error("Erro ao reordenar campos");
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const addField = async (fieldType: string) => {
    const fieldData = {
      form_id: form.id,
      field_type: fieldType,
      title: "Nova Pergunta",
      description: null,
      options: ["dropdown", "checkbox", "radio"].includes(fieldType) ? ["Opção 1"] : null,
      is_required: false,
      ordem: fields.length,
    };

    const { data, error } = await supabase
      .from("lead_onboarding_fields")
      .insert(fieldData)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao adicionar campo");
      return;
    }

    const addedField: OnboardingField = {
      id: data.id,
      form_id: data.form_id,
      field_type: data.field_type,
      title: data.title,
      description: data.description,
      options: data.options,
      is_required: data.is_required,
      ordem: data.ordem,
    };
    setFields([...fields, addedField]);
    setEditingField(data.id);
  };

  const updateField = async (fieldId: string, updates: Partial<OnboardingField>) => {
    // Update local state immediately for real-time preview
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));

    const { error } = await supabase
      .from("lead_onboarding_fields")
      .update(updates)
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao atualizar campo");
    }
  };

  const deleteField = async (fieldId: string) => {
    const { error } = await supabase
      .from("lead_onboarding_fields")
      .delete()
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao remover campo");
      return;
    }

    setFields(fields.filter((f) => f.id !== fieldId));
    if (editingField === fieldId) setEditingField(null);
  };

  const addOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const currentOptions = field.options || [];
    const newOptions = [...currentOptions, `Opção ${currentOptions.length + 1}`];
    updateField(fieldId, { options: newOptions });
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = [...field.options];
    newOptions[optionIndex] = value;
    updateField(fieldId, { options: newOptions });
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = field.options.filter((_: any, i: number) => i !== optionIndex);
    updateField(fieldId, { options: newOptions });
  };

  const changeFieldType = async (fieldId: string, newType: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const needsOptions = ["dropdown", "checkbox", "radio"].includes(newType);
    const hasOptions = field.options && field.options.length > 0;

    const updates: Partial<OnboardingField> = {
      field_type: newType,
      options: needsOptions && !hasOptions ? ["Opção 1"] : needsOptions ? field.options : null,
    };

    await updateField(fieldId, updates);
    toast.success("Tipo de campo alterado");
  };

  const saveSequentialMode = async (newValue: boolean) => {
    setIsSequential(newValue);
    setIsSaving(true);
    const { error } = await supabase
      .from("lead_onboarding_forms")
      .update({ is_sequential: newValue })
      .eq("id", form.id);

    if (error) {
      toast.error("Erro ao salvar");
    }
    setIsSaving(false);
  };

  const handlePublish = async () => {
    if (fields.length === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    setIsPublishing(true);
    const { error } = await supabase
      .from("lead_onboarding_forms")
      .update({
        is_published: true,
        is_sequential: isSequential,
        published_at: new Date().toISOString(),
      })
      .eq("id", form.id);

    if (error) {
      toast.error("Erro ao publicar");
      setIsPublishing(false);
      return;
    }

    toast.success("Formulário publicado!");
    onUpdate();
    onClose();
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find((f) => f.id === type);
    return fieldType?.icon || Type;
  };

  const getFieldLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find((f) => f.id === type);
    return fieldType?.label || type;
  };

  const handleApplyTemplate = async (templateFields: any[], templateIsSequential: boolean) => {
    // Delete existing fields
    if (fields.length > 0) {
      await supabase
        .from("lead_onboarding_fields")
        .delete()
        .eq("form_id", form.id);
    }

    // Create new fields from template
    const newFields: OnboardingField[] = [];
    for (let i = 0; i < templateFields.length; i++) {
      const templateField = templateFields[i];
      const fieldData = {
        form_id: form.id,
        field_type: templateField.field_type,
        title: templateField.title,
        description: templateField.description,
        options: templateField.options,
        is_required: templateField.is_required,
        ordem: i,
      };

      const { data, error } = await supabase
        .from("lead_onboarding_fields")
        .insert(fieldData)
        .select()
        .single();

      if (!error && data) {
        newFields.push({
          id: data.id,
          form_id: data.form_id,
          field_type: data.field_type,
          title: data.title,
          description: data.description,
          options: data.options,
          is_required: data.is_required,
          ordem: data.ordem,
        });
      }
    }

    setFields(newFields);
    setIsSequential(templateIsSequential);

    // Update form sequential mode
    await supabase
      .from("lead_onboarding_forms")
      .update({ is_sequential: templateIsSequential })
      .eq("id", form.id);
  };

  const openSaveTemplateDialog = () => {
    setTemplateDialogMode("save");
    setTemplateDialogOpen(true);
  };

  const openLoadTemplateDialog = () => {
    setTemplateDialogMode("load");
    setTemplateDialogOpen(true);
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-[#00000010] bg-background">
      {/* Header */}
      <div className="h-16 border-b border-[#00000010] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Editor de Onboarding</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openLoadTemplateDialog}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            Usar Modelo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openSaveTemplateDialog}
            disabled={fields.length === 0}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            Salvar Modelo
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || fields.length === 0}
            className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000]"
          >
            {isPublishing ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex h-[calc(100%-64px)]"> 
        {/* Left side - Editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Mode toggle */}
          <Card className="border-[#00000010] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Modo Sequência</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isSequential
                      ? "Perguntas aparecem uma por vez"
                      : "Todas as perguntas aparecem juntas"}
                  </p>
                </div>
                <Switch
                  checked={isSequential}
                  onCheckedChange={saveSequentialMode}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fields list with drag and drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {fields.map((field) => (
                  <SortableFieldCard
                    key={field.id}
                    field={field}
                    isEditing={editingField === field.id}
                    onEdit={() => setEditingField(field.id)}
                    onClose={() => setEditingField(null)}
                    onUpdate={(updates) => updateField(field.id, updates)}
                    onDelete={() => deleteField(field.id)}
                    onAddOption={() => addOption(field.id)}
                    onUpdateOption={(optIndex, value) => updateOption(field.id, optIndex, value)}
                    onRemoveOption={(optIndex) => removeOption(field.id, optIndex)}
                    onChangeFieldType={(newType) => changeFieldType(field.id, newType)}
                    getFieldIcon={getFieldIcon}
                    getFieldLabel={getFieldLabel}
                    isDragging={activeId === field.id}
                  />
                ))}
              </div>
            </SortableContext>

            {typeof document !== "undefined"
              ? createPortal(
                  <DragOverlay
                    zIndex={99999}
                    dropAnimation={null}
                  >
                    {activeField ? (
                      <SortableFieldCard
                        field={activeField}
                        isEditing={false}
                        onEdit={() => {}}
                        onClose={() => {}}
                        onUpdate={() => {}}
                        onDelete={() => {}}
                        onAddOption={() => {}}
                        onUpdateOption={() => {}}
                        onRemoveOption={() => {}}
                        onChangeFieldType={() => {}}
                        getFieldIcon={getFieldIcon}
                        getFieldLabel={getFieldLabel}
                        isOverlay
                      />
                    ) : null}
                  </DragOverlay>,
                  document.body
                )
              : null}
          </DndContext>

          {/* Add field button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full border-2 border-dashed border-black/20 rounded-lg p-4 flex items-center justify-center gap-2 hover:border-black/40 hover:bg-muted/20 transition-colors cursor-pointer">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-medium">Adicionar Campo</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {FIELD_TYPES.map((type) => (
                <DropdownMenuItem
                  key={type.id}
                  onClick={() => addField(type.id)}
                  className="cursor-pointer"
                >
                  <type.icon className="h-4 w-4 mr-2" />
                  {type.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side - Preview */}
        <div className="w-[400px] bg-muted/30 overflow-y-auto border-l border-[#00000010] hidden xl:block">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">Pré-visualização em tempo real</span>
            </div>
            <OnboardingPreview
              fields={fields}
              isSequential={isSequential}
              formName={form.name}
            />
          </div>
        </div>
      </div>

      {/* Template Dialog */}
      <FormTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        mode={templateDialogMode}
        currentFields={fields}
        isSequential={isSequential}
        onApplyTemplate={handleApplyTemplate}
      />
    </div>
  );
}
