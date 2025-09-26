import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative bg-card border border-border rounded-xl shadow-xl w-full mx-4 ${maxWidth} max-h-[90vh] overflow-hidden animate-scale-in`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-card-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;