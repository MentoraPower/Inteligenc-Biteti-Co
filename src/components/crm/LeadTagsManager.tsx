import { useState, useEffect } from "react";
import { Plus, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
  color: string;
  lead_id: string;
}

interface LeadTagsManagerProps {
  leadId: string;
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

export function LeadTagsManager({ leadId }: LeadTagsManagerProps) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<{name: string; color: string}[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Edit state
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Invalidate all tag-related queries to update Kanban and other views
  const invalidateTagQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["lead-tags-full-related"] });
    queryClient.invalidateQueries({ queryKey: ["all-tags"] });
  };

  useEffect(() => {
    fetchTags();
    fetchAllTags();
  }, [leadId]);

  const fetchTags = async () => {
    try {
      // Get current lead contact info
      const { data: currentLead, error: leadError } = await supabase
        .from("leads")
        .select("email, whatsapp")
        .eq("id", leadId)
        .maybeSingle();

      if (leadError || !currentLead) {
        console.error("Error fetching lead for tags:", leadError);
        // Fallback: fetch tags only for this lead
        const { data, error } = await supabase
          .from("lead_tags")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true });
        if (error) console.error("Error fetching tags:", error);
        setTags(data || []);
        return;
      }

      const filters: string[] = [];
      if (currentLead.email) filters.push(`email.eq.${currentLead.email}`);
      if (currentLead.whatsapp) filters.push(`whatsapp.eq.${currentLead.whatsapp}`);
      if (filters.length === 0) filters.push(`id.eq.${leadId}`);

      // Find all leads related by email/whatsapp (so details shows same tags as the cards)
      const { data: relatedLeads, error: relatedError } = await supabase
        .from("leads")
        .select("id")
        .or(filters.join(","));

      const leadIds = (relatedError || !relatedLeads || relatedLeads.length === 0)
        ? [leadId]
        : relatedLeads.map((l) => l.id);

      const { data, error } = await supabase
        .from("lead_tags")
        .select("*")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching tags:", error);
        setTags([]);
        return;
      }

      // Dedupe by name (case-insensitive). Prefer the tag from the current lead if it exists.
      const unique = new Map<string, Tag>();
      (data || []).forEach((tag) => {
        const key = (tag.name || "").trim().toLowerCase();
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, tag);
          return;
        }
        if (tag.lead_id === leadId && existing.lead_id !== leadId) {
          unique.set(key, tag);
        }
      });

      setTags(Array.from(unique.values()));
    } catch (err) {
      console.error("Error fetching tags:", err);
      setTags([]);
    }
  };

  const fetchAllTags = async () => {
    const PAGE_SIZE = 1000;
    let allTagsData: { name: string; color: string }[] = [];
    let page = 0;
    let hasMore = true;
    
    // Fetch all pages to get ALL tags
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error } = await supabase
        .from("lead_tags")
        .select("name, color")
        .range(from, to)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching all tags page:", error);
        break;
      }

      if (data && data.length > 0) {
        allTagsData = [...allTagsData, ...data];
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Get unique tags by name (case-insensitive, keep first occurrence)
    const uniqueMap = new Map<string, { name: string; color: string }>();
    allTagsData.forEach((tag) => {
      const key = (tag.name || "").trim().toLowerCase();
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, { name: tag.name, color: tag.color });
      }
    });

    // Convert to array and sort alphabetically
    const uniqueTags = Array.from(uniqueMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    setAllTags(uniqueTags);
  };

  // Normalize string for accent-insensitive search
  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  // Filter suggestions based on input - show all matching tags (accent-insensitive)
  const suggestions = newTagName.trim()
    ? allTags.filter(tag => 
        normalizeString(tag.name).includes(normalizeString(newTagName))
      ).map(tag => ({
        ...tag,
        alreadyAdded: !!tags.find(t => t.name.toLowerCase() === tag.name.toLowerCase())
      }))
    : [];

  const handleSelectSuggestion = (suggestion: {name: string; color: string; alreadyAdded: boolean}) => {
    if (suggestion.alreadyAdded) {
      toast.info("Essa tag já está adicionada neste lead");
      return;
    }
    setNewTagName(suggestion.name);
    setSelectedColor(suggestion.color);
    setShowColorPicker(true);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    // Check if tag with same name already exists on this lead
    const existingTag = tags.find(
      t => t.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    if (existingTag) {
      toast.error("Essa tag já existe neste lead");
      return;
    }

    setIsLoading(true);

    try {
      // First, get the current lead's contact info
      const { data: currentLead, error: leadError } = await supabase
        .from("leads")
        .select("email, whatsapp")
        .eq("id", leadId)
        .single();

      if (leadError) {
        console.error("Error fetching lead:", leadError);
        toast.error("Erro ao buscar informações do lead");
        setIsLoading(false);
        return;
      }

      // Find all leads with the same email or whatsapp
      const { data: relatedLeads, error: relatedError } = await supabase
        .from("leads")
        .select("id")
        .or(`email.eq.${currentLead.email},whatsapp.eq.${currentLead.whatsapp}`);

      if (relatedError) {
        console.error("Error fetching related leads:", relatedError);
        toast.error("Erro ao buscar leads relacionados");
        setIsLoading(false);
        return;
      }

      const tagName = newTagName.trim();
      const tagsToInsert: { lead_id: string; name: string; color: string }[] = [];

      // For each related lead, check if the tag already exists
      for (const lead of relatedLeads || []) {
        const { data: existingTags } = await supabase
          .from("lead_tags")
          .select("id")
          .eq("lead_id", lead.id)
          .ilike("name", tagName);

        // Only add if tag doesn't exist on this lead
        if (!existingTags || existingTags.length === 0) {
          tagsToInsert.push({
            lead_id: lead.id,
            name: tagName,
            color: selectedColor,
          });
        }
      }

      if (tagsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("lead_tags")
          .insert(tagsToInsert);

        if (insertError) {
          console.error("Error adding tags:", insertError);
          toast.error("Erro ao adicionar tag");
          setIsLoading(false);
          return;
        }
      }

      // Refresh local tags and invalidate queries for Kanban update
      await fetchTags();
      invalidateTagQueries();
      setNewTagName("");
      setSelectedColor(TAG_COLORS[0]);
      setShowColorPicker(false);
      setIsOpen(false);
      
      const count = tagsToInsert.length;
      if (count > 1) {
        toast.success(`Tag adicionada em ${count} leads`);
      } else {
        toast.success("Tag adicionada");
      }
    } catch (err) {
      console.error("Error in handleAddTag:", err);
      toast.error("Erro ao adicionar tag");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const tagToRemove = tags.find(t => t.id === tagId);
    if (!tagToRemove) return;

    try {
      // Get the current lead's contact info
      const { data: currentLead, error: leadError } = await supabase
        .from("leads")
        .select("email, whatsapp")
        .eq("id", leadId)
        .single();

      if (leadError) {
        console.error("Error fetching lead:", leadError);
        toast.error("Erro ao buscar informações do lead");
        return;
      }

      // Find all leads with the same email or whatsapp
      const { data: relatedLeads, error: relatedError } = await supabase
        .from("leads")
        .select("id")
        .or(`email.eq.${currentLead.email},whatsapp.eq.${currentLead.whatsapp}`);

      if (relatedError) {
        console.error("Error fetching related leads:", relatedError);
        toast.error("Erro ao buscar leads relacionados");
        return;
      }

      const leadIds = relatedLeads?.map(l => l.id) || [];

      // Delete the tag from all related leads
      const { error: deleteError } = await supabase
        .from("lead_tags")
        .delete()
        .in("lead_id", leadIds)
        .ilike("name", tagToRemove.name);

      if (deleteError) {
        console.error("Error removing tags:", deleteError);
        toast.error("Erro ao remover tag");
        return;
      }

      setTags(tags.filter((t) => t.id !== tagId));
      invalidateTagQueries();
      toast.success("Tag removida de todos os leads relacionados");
    } catch (err) {
      console.error("Error in handleRemoveTag:", err);
      toast.error("Erro ao remover tag");
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTag || !editTagName.trim()) return;
    
    setIsEditLoading(true);
    
    try {
      // Update all tags with the same name across all leads
      const { error } = await supabase
        .from("lead_tags")
        .update({ 
          name: editTagName.trim(),
          color: editTagColor 
        })
        .eq("name", editingTag.name);

      if (error) {
        console.error("Error updating tags:", error);
        toast.error("Erro ao atualizar tag");
        return;
      }

      // Refresh local tags and invalidate queries for Kanban update
      await fetchTags();
      await fetchAllTags();
      invalidateTagQueries();
      
      setIsEditOpen(false);
      setEditingTag(null);
      toast.success("Tag atualizada em todos os leads");
    } catch (err) {
      console.error("Error in handleSaveEdit:", err);
      toast.error("Erro ao atualizar tag");
    } finally {
      setIsEditLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Popover 
          key={tag.id} 
          open={isEditOpen && editingTag?.id === tag.id} 
          onOpenChange={(open) => {
            if (!open) {
              setIsEditOpen(false);
              setEditingTag(null);
            }
          }}
        >
          <PopoverTrigger asChild>
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold leading-none text-white cursor-pointer hover:opacity-95 transition-all duration-200 group"
              style={{ backgroundColor: tag.color }}
              onClick={() => handleStartEdit(tag)}
            >
              {tag.name}
              {/* Edit pencil expands in on hover, pushing the content beside it */}
              <span className="inline-flex items-center overflow-hidden max-w-0 min-w-0 opacity-0 group-hover:max-w-4 group-hover:ml-1.5 group-hover:opacity-100 transition-all duration-200">
                <Pencil className="h-3 w-3 flex-shrink-0" />
              </span>
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Nome da tag</p>
                <Input
                  placeholder="Nome da tag"
                  value={editTagName}
                  onChange={(e) => setEditTagName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveEdit();
                    }
                  }}
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
                {/* Custom color only (manual RGB) */}
                <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                  <span
                    className="h-8 w-8 rounded-full ring-1 ring-black/10 relative overflow-hidden flex-shrink-0"
                    style={{ background: editTagColor }}
                  >
                    <input
                      type="color"
                      value={editTagColor}
                      onChange={(e) => setEditTagColor(e.target.value)}
                      className="absolute -inset-1 opacity-0 cursor-pointer"
                    />
                  </span>
                  <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{editTagColor}</span>
                </label>
              </div>

              {/* Preview */}
              {editTagName.trim() && (
                <div className="pt-2 border-t border-black/5">
                  <p className="text-xs text-muted-foreground mb-1">Preview</p>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: editTagColor }}
                  >
                    {editTagName}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleRemoveTag(tag.id)}
                  className="flex-1 h-8 text-sm text-destructive hover:text-destructive"
                >
                  Excluir
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editTagName.trim() || isEditLoading}
                  className="flex-1 h-9 text-sm rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
                >
                  {isEditLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}

      {/* Add tag button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            title="Adicionar tag"
            className={`h-6 px-0 rounded-full inline-flex items-center justify-center border-black/10 dark:border-white/15 bg-transparent hover:bg-muted/50 transition-all duration-300 overflow-hidden flex-shrink-0 ${
              isHovered || isOpen ? "w-[116px]" : "w-6"
            }`}
            onMouseEnter={() => setTimeout(() => setIsHovered(true), 100)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Plus className="h-3.5 w-3.5 flex-shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap text-xs transition-all duration-300 ${
                isHovered || isOpen ? "max-w-[100px] ml-1.5 opacity-100" : "max-w-0 min-w-0 opacity-0"
              }`}
            >
              Adicionar tag
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0 rounded-2xl overflow-hidden shadow-xl" align="start">
          <div className="px-4 py-3.5 border-b border-border">
            <h4 className="text-sm font-semibold">Adicionar tag</h4>
          </div>
          <div className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                placeholder="Nome da tag"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-10 rounded-lg text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag();
                  }
                }}
                autoFocus
              />

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-1.5 border border-border rounded-lg overflow-hidden">
                  {suggestions.slice(0, 5).map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                        suggestion.alreadyAdded
                          ? "bg-muted/30 text-muted-foreground cursor-default"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: suggestion.color }}
                      />
                      <span className="flex-1">{suggestion.name}</span>
                      {suggestion.alreadyAdded && (
                        <span className="text-xs text-muted-foreground">já adicionada</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color (custom only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cor</label>
              <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                <span
                  className="h-9 w-9 rounded-lg ring-1 ring-black/10 relative overflow-hidden flex-shrink-0"
                  style={{ background: selectedColor }}
                >
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute -inset-1 opacity-0 cursor-pointer"
                  />
                </span>
                <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{selectedColor}</span>
              </label>
            </div>

            {/* Preview */}
            {newTagName.trim() && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pré-visualização</label>
                <div>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: selectedColor }}
                  >
                    {newTagName}
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleAddTag}
              disabled={!newTagName.trim() || isLoading}
              className="w-full h-10 text-sm rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold"
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
