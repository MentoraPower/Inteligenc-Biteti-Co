import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import scaleLogo from "@/assets/scale-logo-red.png";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  lead_id: string;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any; // JSON from database - will be string[]
  is_required: boolean;
  ordem: number;
}

export default function OnboardingForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [fields, setFields] = useState<OnboardingField[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [notFound, setNotFound] = useState(false);
  
  // Intro animation states
  const [introPhase, setIntroPhase] = useState<'logo' | 'message' | 'form'>('logo');
  const [displayedText, setDisplayedText] = useState('');
  const welcomeMessage = "Seja bem-vinda a SCALE BEAUTY.";
  const gradientStartIndex = 17; // "Seja bem-vinda a " length

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) return;

      const { data: formData, error } = await supabase
        .from("lead_onboarding_forms")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error || !formData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setForm(formData);

      const { data: fieldsData } = await supabase
        .from("lead_onboarding_fields")
        .select("*")
        .eq("form_id", formData.id)
        .order("ordem", { ascending: true }) as { data: OnboardingField[] | null };

      setFields(fieldsData || []);
      setIsLoading(false);
    };

    fetchForm();
  }, [slug]);

  // Intro animation sequence
  useEffect(() => {
    if (isLoading || notFound) return;

    // Show logo for 1.5 seconds
    const logoTimer = setTimeout(() => {
      setIntroPhase('message');
    }, 1500);

    return () => clearTimeout(logoTimer);
  }, [isLoading, notFound]);

  // Typewriter effect for message
  useEffect(() => {
    if (introPhase !== 'message') return;

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex <= welcomeMessage.length) {
        setDisplayedText(welcomeMessage.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        // After message is complete, wait 1 second then show form
        setTimeout(() => {
          setIntroPhase('form');
        }, 1000);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [introPhase]);

  const handleInputChange = (fieldId: string, value: string | string[]) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setResponses((prev) => {
      const current = (prev[fieldId] as string[]) || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((o) => o !== option) };
      }
    });
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Validate required fields
    for (const field of fields) {
      if (field.is_required) {
        const response = responses[field.id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          toast.error(`Por favor, preencha: ${field.title}`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    // Save responses
    const responsesToInsert = fields.map((field) => ({
      form_id: form.id,
      field_id: field.id,
      response_value: typeof responses[field.id] === "string" ? (responses[field.id] as string) : null,
      response_options:
        Array.isArray(responses[field.id]) ? responses[field.id] : null,
    }));

    const { error } = await supabase
      .from("lead_onboarding_responses")
      .insert(responsesToInsert);

    if (error) {
      toast.error("Erro ao enviar respostas");
      setIsSubmitting(false);
      return;
    }

    // Check for onboarding_completed automations and move lead
    try {
      // Get lead info to find sub_origin_id
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, sub_origin_id, pipeline_id")
        .eq("id", form.lead_id)
        .single();

      if (leadData?.sub_origin_id) {
        // Find active automations for this sub_origin with onboarding_completed trigger
        const { data: automations } = await supabase
          .from("pipeline_automations")
          .select("*")
          .eq("sub_origin_id", leadData.sub_origin_id)
          .eq("trigger_type", "onboarding_completed")
          .eq("is_active", true);

        if (automations && automations.length > 0) {
          // Use the first matching automation
          const automation = automations[0];
          
          // Move lead to the target
          const updateData: any = {};
          if (automation.target_sub_origin_id) {
            updateData.sub_origin_id = automation.target_sub_origin_id;
          }
          if (automation.target_pipeline_id) {
            updateData.pipeline_id = automation.target_pipeline_id;
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("leads")
              .update(updateData)
              .eq("id", form.lead_id);

            // Add tracking entry
            await supabase.from("lead_tracking").insert({
              lead_id: form.lead_id,
              tipo: "automacao",
              titulo: "Automação: Onboarding preenchido",
              descricao: "Lead movido automaticamente após preenchimento do onboarding",
              origem: "onboarding",
            });
          }
        }
      }
    } catch (autoError) {
      console.error("Error processing automation:", autoError);
      // Don't fail the submission if automation fails
    }

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  const renderField = (field: OnboardingField) => {
    switch (field.field_type) {
      case "text_short":
        return (
          <Textarea
            value={(responses[field.id] as string) || ""}
            onChange={(e) => {
              handleInputChange(field.id, e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Digite sua resposta"
            className="min-h-[56px] resize-none overflow-hidden text-base"
            rows={1}
          />
        );

      case "text_long":
        return (
          <Textarea
            value={(responses[field.id] as string) || ""}
            onChange={(e) => {
              handleInputChange(field.id, e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Digite sua resposta"
            className="min-h-[100px] resize-none overflow-hidden text-base"
          />
        );

      case "number":
        return (
          <Input
            value={(responses[field.id] as string) || ""}
            onChange={(e) => {
              // Remove everything except digits
              let digits = e.target.value.replace(/\D/g, "");
              
              // Limit to reasonable amount (prevent overflow)
              if (digits.length > 12) {
                digits = digits.slice(0, 12);
              }
              
              // Convert to number (in cents)
              const numericValue = parseInt(digits || "0", 10);
              
              // Format as Brazilian Real
              const formatted = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(numericValue / 100);
              
              handleInputChange(field.id, formatted);
            }}
            placeholder="R$ 0,00"
            className="font-mono h-14 text-base"
            inputMode="numeric"
          />
        );

      case "dropdown":
        return (
          <Select
            value={(responses[field.id] as string) || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            <SelectTrigger className="h-14 text-base">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option} className="text-base py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-gradient-to-b from-[#F40000] to-[#A10000] rounded-full" />
                    {option}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
      case "checkbox":
        return (
          <div className="space-y-3">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Checkbox
                  id={`${field.id}-${index}`}
                  checked={((responses[field.id] as string[]) || []).includes(option)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(field.id, option, checked as boolean)
                  }
                  className="h-6 w-6"
                />
                <Label htmlFor={`${field.id}-${index}`} className="text-base">{option}</Label>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" />
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold mb-2">Formulário não encontrado</h1>
            <p className="text-muted-foreground">
              Este formulário não existe ou não está disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Intro animation - Logo phase
  if (introPhase === 'logo') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.5 }}
        >
          <img 
            src={scaleLogo} 
            alt="Scale" 
            className="h-16 md:h-20 w-auto"
          />
        </motion.div>
      </div>
    );
  }

  // Intro animation - Message phase
  if (introPhase === 'message') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-lg md:text-3xl font-semibold text-foreground">
            {displayedText.length <= gradientStartIndex ? (
              <>
                {displayedText}
                <span className="animate-pulse">|</span>
              </>
            ) : (
              <>
                {displayedText.slice(0, gradientStartIndex)}
                <span className="bg-gradient-to-r from-[#F40000] to-[#A10000] bg-clip-text text-transparent">
                  {displayedText.slice(gradientStartIndex)}
                </span>
                <span className="animate-pulse">|</span>
              </>
            )}
          </h1>
        </motion.div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full text-center"
        >
          <img 
            src={scaleLogo} 
            alt="Scale" 
            className="h-16 w-auto mx-auto mb-8"
          />
          <h1 className="text-2xl font-semibold mb-4">Obrigado!</h1>
          <p className="text-muted-foreground leading-relaxed max-w-[280px] md:max-w-none mx-auto">
            Nosso time da Scale entrará em contato para agendar seu onboarding.
          </p>
        </motion.div>
      </div>
    );
  }

  // Sequential mode
  if (form?.is_sequential && fields.length > 0) {
    const currentField = fields[currentStep];
    const isLastStep = currentStep === fields.length - 1;
    const canProceed = !currentField.is_required || 
      (responses[currentField.id] && 
        (typeof responses[currentField.id] === "string" 
          ? responses[currentField.id] !== "" 
          : (responses[currentField.id] as string[]).length > 0));

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-background flex flex-col"
      >
        {/* Progress bar - fixed at top */}
        <div className="fixed top-0 left-0 right-0 z-50 w-full h-2 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-[#F40000] to-[#A10000] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / fields.length) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center px-8 md:px-6 py-8 pt-10">
          <div className="max-w-lg w-full -mt-16 md:-mt-24">
            {/* Logo */}
            <div className="flex justify-center mb-10 md:mb-12">
              <img 
                src={scaleLogo} 
                alt="Scale" 
                className="h-12 md:h-16 w-auto"
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, filter: "blur(4px)", x: 40 }}
                animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                exit={{ opacity: 0, filter: "blur(4px)", x: -40 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <h2 className="text-2xl font-semibold mb-2">{currentField.title}</h2>
                {currentField.description && (
                  <p className="text-muted-foreground mb-6">{currentField.description}</p>
                )}
                <div className="mb-8">{renderField(currentField)}</div>
              </motion.div>
            </AnimatePresence>

            <div className={`flex ${currentStep === 0 ? "justify-center" : "justify-center gap-3"}`}>
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="h-14 md:h-10 rounded-full px-6"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}

              {isLastStep ? (
                <Button
                  onClick={() => {
                    if (!canProceed) {
                      toast.error("Preencha o campo para continuar");
                      return;
                    }
                    handleSubmit();
                  }}
                  disabled={isSubmitting}
                  className={`bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000] text-white h-14 md:h-10 rounded-full px-6 ${currentStep === 0 ? "w-full max-w-xs" : ""}`}
                >
                  {isSubmitting ? "Enviando..." : "Enviar"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!canProceed) {
                      toast.error("Preencha o campo para continuar");
                      return;
                    }
                    setCurrentStep((s) => s + 1);
                  }}
                  className={`bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000] text-white h-14 md:h-10 rounded-full px-6 ${currentStep === 0 ? "w-full max-w-xs" : ""}`}
                >
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // All fields at once mode
  return (
    <div className="min-h-screen bg-background py-8 px-8 md:px-6">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-10 md:mb-12">
          <img 
            src={scaleLogo} 
            alt="Scale" 
            className="h-12 md:h-16 w-auto"
          />
        </div>

        <div className="space-y-6">
          {fields.map((field) => (
            <Card key={field.id} className="border-[#00000010] shadow-none">
              <CardContent className="p-6">
                <Label className="text-base font-medium">
                  {field.title}
                </Label>
                {field.description && (
                  <p className="text-sm text-muted-foreground mb-3">{field.description}</p>
                )}
                <div className="mt-3">{renderField(field)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#F40000] to-[#A10000]"
          >
            {isSubmitting ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
