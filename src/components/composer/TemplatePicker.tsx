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
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Choose a Template</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-3 py-2 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 text-sm"
            />
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-2 overflow-y-auto flex-1">
              {filtered.map((t) => (
                <button
                  key={t._id}
                  onClick={() => handleTemplateSelect(t.template)}
                  className="w-full text-left p-3 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-blue-500 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-gray-500 group-hover:text-blue-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-white text-sm group-hover:text-blue-400">{t.templateName}</h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.template}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {searchTerm ? (
                <>
                  <p className="text-white">No templates found for &ldquo;{searchTerm}&rdquo;</p>
                  <p className="text-xs mt-1 text-gray-500">Try a different search term</p>
                </>
              ) : (
                <>
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-white">No templates available</p>
                  <p className="text-xs mt-1 text-gray-500">Create templates via the API to use them here</p>
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
