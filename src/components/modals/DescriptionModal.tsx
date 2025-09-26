import Modal from "./Modal";
import { FileText } from "lucide-react";

interface DescriptionModalProps {
  author: string;
  permlink: string;
  content: string;
  onClose: () => void;
}

const DescriptionModal = ({ author, permlink, content, onClose }: DescriptionModalProps) => {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Video Description"
      maxWidth="max-w-2xl"
    >
      <div className="p-6">
        {content ? (
          <div className="prose prose-sm max-w-none">
            <div className="bg-muted/30 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-card-foreground font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No description available</p>
            <p className="text-sm text-muted-foreground mt-1">
              This video doesn't have a description yet.
            </p>
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>By @{author}</span>
            <span>•</span>
            <span>/{permlink}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DescriptionModal;