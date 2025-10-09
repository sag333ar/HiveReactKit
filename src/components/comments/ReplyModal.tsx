import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import AddCommentInput from './AddCommentInput';

interface ReplyModalProps {
  parentAuthor: string;
  parentPermlink: string;
  onClose: () => void;
  onCommentSubmitted: (parentAuthor: string, parentPermlink: string, body: string) => Promise<void>;
  currentUser?: string;
}

const ReplyModal = ({ 
  parentAuthor, 
  parentPermlink, 
  onClose, 
  onCommentSubmitted, 
  currentUser 
}: ReplyModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (body: string) => {
    if (!body.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onCommentSubmitted(parentAuthor, parentPermlink, body);
      onClose();
    } catch (error) {
      console.error('Failed to submit reply:', error);
      // TODO: Show error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Reply to Comment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{parentAuthor}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AddCommentInput
            onSubmit={handleSubmit}
            onCancel={onClose}
            currentUser={currentUser}
            parentAuthor={parentAuthor}
            parentPermlink={parentPermlink}
            placeholder={`Reply to @${parentAuthor}...`}
          />
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>• Markdown supported</span>
              <span>• Be respectful</span>
            </div>
            <div className="hidden md:block">
              Press Esc to close
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplyModal;