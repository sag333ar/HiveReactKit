import React, { useState, useRef, useEffect } from 'react';
import { Send, X, User } from 'lucide-react';

interface AddCommentInputProps {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  currentUser?: string;
  placeholder?: string;
  parentAuthor?: string;
  parentPermlink?: string;
}

const AddCommentInput = ({
  onSubmit,
  onCancel,
  currentUser,
  placeholder = "Write your comment...",
  parentAuthor,
  parentPermlink
}: AddCommentInputProps) => {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-white dark:bg-gray-800">
      {/* Header with user info - left-aligned with avatar */}
      <div className="flex items-center justify-start space-x-3 text-left">
        <div className="flex-shrink-0">
          {currentUser ? (
            <img
              src={`https://images.hive.blog/u/${currentUser}/avatar`}
              alt={currentUser}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`;
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm text-gray-900 dark:text-white font-medium">
            {currentUser ? `@${currentUser}` : 'Anonymous'}
          </div>
          {parentAuthor && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Replying to @{parentAuthor}
            </div>
          )}
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="w-full min-h-[100px] max-h-[300px] p-4 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 disabled:opacity-50"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Press Cmd+Enter to post
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !body.trim()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCommentInput;