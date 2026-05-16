import React, { useRef, useEffect, useState } from 'react';
import { FileText, X, Search } from 'lucide-react';
import { TemplateModel } from '../../services/templateService';

export interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: string) => void;
  templates: TemplateModel[];
  /** If provided, {{author}} in templates is replaced with this value */
  authorFromUrl?: string;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  templates,
  authorFromUrl,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleTemplateSelect = (template: string) => {
    const processed = authorFromUrl
      ? template.replace(/\{\{author\}\}/g, authorFromUrl)
      : template;
    onSelectTemplate(processed);
    onClose();
  };

  const filtered = templates.filter(t =>
    t.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.template.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--hrk-border-subtle)]">
          <h3 className="text-lg font-semibold text-white">Choose a Template</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--hrk-bg-surface)] rounded transition-colors">
            <X className="h-5 w-5 text-[var(--hrk-text-tertiary)]" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hrk-text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-3 py-2 border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--hrk-info)] text-white placeholder-[var(--hrk-text-tertiary)] text-sm"
            />
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-1">
              {filtered.map((t) => (
                <button
                  key={t._id}
                  onClick={() => handleTemplateSelect(t.template)}
                  className="w-full text-left p-3 border border-[var(--hrk-border-subtle)] rounded-lg hover:bg-[var(--hrk-bg-surface)] hover:border-blue-500 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-[var(--hrk-text-tertiary)] group-hover:text-[var(--hrk-info)] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-white text-sm group-hover:text-[var(--hrk-info)]">{t.templateName}</h4>
                      <p className="text-xs text-[var(--hrk-text-tertiary)] mt-1 line-clamp-2">{t.template}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--hrk-text-tertiary)]">
              {searchTerm ? (
                <>
                  <p className="text-white">No templates found for &ldquo;{searchTerm}&rdquo;</p>
                  <p className="text-xs mt-1 text-[var(--hrk-text-tertiary)]">Try a different search term</p>
                </>
              ) : (
                <>
                  <FileText className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
                  <p className="text-white">No templates available</p>
                  <p className="text-xs mt-1 text-[var(--hrk-text-tertiary)]">Create templates via the API to use them here</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatePicker;
