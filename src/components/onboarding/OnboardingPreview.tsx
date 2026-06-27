import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import scaleLogo from "@/assets/scale-logo-red.png";

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

interface OnboardingPreviewProps {
  fields: OnboardingField[];
  isSequential: boolean;
  formName: string;
}

export function OnboardingPreview({ fields, isSequential, formName }: OnboardingPreviewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  if (fields.length === 0) {
    return (
      <div className="bg-background min-h-[500px] flex flex-col">
        {/* Logo */}
        <div className="flex justify-center pt-8 pb-6">
          <img src={scaleLogo} alt="Scale" className="h-12 w-auto" />
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Adicione campos ao formulário para ver a pré-visualização
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentField = isSequential ? fields[currentStep] : null;

  const renderField = (field: OnboardingField) => {
    switch (field.field_type) {
      case "text_short":
        return (
          <Textarea
            placeholder="Digite sua resposta"
            value={responses[field.id] || ""}
            onChange={(e) => {
              setResponses({ ...responses, [field.id]: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            className="min-h-[56px] resize-none overflow-hidden text-base"
            rows={1}
          />
        );
      
      case "text_long":
        return (
          <Textarea
            placeholder="Digite sua resposta"
            value={responses[field.id] || ""}
            onChange={(e) => {
              setResponses({ ...responses, [field.id]: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            className="min-h-[100px] resize-none overflow-hidden text-base"
          />
        );
      
      case "number":
        return (
          <Input
            type="text"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={responses[field.id] || ""}
            onChange={(e) => {
              let digits = e.target.value.replace(/\D/g, "");
              if (digits.length > 12) {
                digits = digits.slice(0, 12);
              }
              const numericValue = parseInt(digits || "0", 10);
              const formatted = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(numericValue / 100);
              setResponses({ ...responses, [field.id]: formatted });
            }}
            className="font-mono h-14 text-base"
          />
        );
      
      case "dropdown":
        return (
          <Select
            value={responses[field.id] || ""}
            onValueChange={(value) => setResponses({ ...responses, [field.id]: value })}
          >
            <SelectTrigger className="h-14 text-base">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: string, index: number) => (
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
      
      case "checkbox":
      case "radio":
        return (
          <div className="space-y-3">
            {field.options?.map((option: string, index: number) => {
              const currentValues = (responses[field.id] as string[]) || [];
              const isChecked = currentValues.includes(option);
              
              return (
                <div key={index} className="flex items-center space-x-3">
                  <Checkbox
                    id={`preview-${field.id}-${index}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setResponses({ ...responses, [field.id]: [...currentValues, option] });
                      } else {
                        setResponses({ ...responses, [field.id]: currentValues.filter((v) => v !== option) });
                      }
                    }}
                    className="h-6 w-6"
                  />
                  <Label htmlFor={`preview-${field.id}-${index}`} className="text-base cursor-pointer">
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Sequential mode
  if (isSequential && currentField) {
    const progress = ((currentStep + 1) / fields.length) * 100;
    const isLastStep = currentStep === fields.length - 1;
    
    return (
      <div className="bg-background min-h-[500px] flex flex-col">
        {/* Progress bar - fixed at top */}
        <div className="w-full h-2 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-[#F40000] to-[#A10000] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-8">
          <div className="max-w-lg w-full">
            {/* Logo */}
            <div className="flex justify-center mb-10">
              <img src={scaleLogo} alt="Scale" className="h-12 w-auto" />
            </div>

            {/* Field content */}
            <div>
              <h2 className="text-2xl font-semibold mb-2">{currentField.title}</h2>
              {currentField.description && (
                <p className="text-muted-foreground mb-6">{currentField.description}</p>
              )}
              <div className="mb-8">{renderField(currentField)}</div>
            </div>

            {/* Navigation */}
            <div className={`flex ${currentStep === 0 ? "justify-center" : "justify-center gap-3"}`}>
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  className="h-10 rounded-full px-6"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}
              
              {isLastStep ? (
                <Button
                  className={`bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000] text-white h-10 rounded-full px-6 ${currentStep === 0 ? "w-full max-w-xs" : ""}`}
                >
                  Enviar
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className={`bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000] text-white h-10 rounded-full px-6 ${currentStep === 0 ? "w-full max-w-xs" : ""}`}
                >
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All fields at once mode
  return (
    <div className="bg-background min-h-[500px] py-8 px-8">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src={scaleLogo} alt="Scale" className="h-12 w-auto" />
        </div>

        {/* Fields */}
        <div className="space-y-6">
          {fields.map((field) => (
            <div key={field.id}>
              <h2 className="text-lg font-semibold mb-1">
                {field.title}
                {field.is_required && <span className="text-destructive ml-1">*</span>}
              </h2>
              {field.description && (
                <p className="text-muted-foreground text-sm mb-3">{field.description}</p>
              )}
              {renderField(field)}
            </div>
          ))}
          
          {/* Submit button */}
          <div className="flex justify-center pt-4">
            <Button
              className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000] text-white h-10 rounded-full px-6 w-full max-w-xs"
            >
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
