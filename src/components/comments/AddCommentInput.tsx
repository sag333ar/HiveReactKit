/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, User, Bold, Italic, Link, Smile } from 'lucide-react';
import ImageUploader from '../composer/ImageUploader';
import AudioUploader from '../composer/AudioUploader';
import VideoUploader from '../composer/VideoUploader';
import GiphyPicker from '../composer/GiphyPicker';
import EmojiPicker from '../composer/EmojiPicker';

export interface AddCommentInputProps {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  currentUser?: string;
  placeholder?: string;
  parentAuthor?: string;
  parentPermlink?: string;

  /** Ecency image hosting token — enables image and video thumbnail upload */
  ecencyToken?: string;
  /** 3Speak API key — enables audio and video upload. Falls back to demo key if not provided. */
  threeSpeakApiKey?: string;
  /** GIPHY API key — enables GIF search */
  giphyApiKey?: string;

  /** Hide individual toolbar features */
  hideBold?: boolean;
  hideItalic?: boolean;
  hideLink?: boolean;
  hideImage?: boolean;
  hideAudio?: boolean;
  hideVideo?: boolean;
  hideEmoji?: boolean;
  hideGif?: boolean;
}

const AddCommentInput = ({
  onSubmit,
  onCancel,
  currentUser,
  placeholder = "Write in Markdown...",
  parentAuthor,
  parentPermlink,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  hideBold,
  hideItalic,
  hideLink,
  hideImage,
  hideAudio,
  hideVideo,
  hideEmoji,
  hideGif,
}: AddCommentInputProps) => {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [audioEmbedUrl, setAudioEmbedUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const insertAtCursor = useCallback((before: string, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }, [body]);

  const insertText = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    setBody(body.slice(0, start) + text + body.slice(start));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }, [body]);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let finalBody = body.trim();
      if (audioEmbedUrl) finalBody += `\n${audioEmbedUrl}`;
      if (videoEmbedUrl) finalBody += `\n${videoEmbedUrl}`;
      await onSubmit(finalBody);
      setBody('');
      setAudioEmbedUrl(null);
      setAudioDuration(0);
      setVideoEmbedUrl(null);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') onCancel();
  };

  const removeAudio = () => { setAudioEmbedUrl(null); setAudioDuration(0); };
  const removeVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoEmbedUrl(null); setVideoPreviewUrl(null);
  };

  const toolbarBtnClass = "p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50";

  return (
    <div className="p-4 md:p-6 space-y-3 bg-gray-900 rounded-xl border border-gray-700">
      {/* Header with user info */}
      <div className="flex items-center justify-start space-x-3 text-left">
        <div className="flex-shrink-0">
          {currentUser ? (
            <img
              src={`https://images.hive.blog/u/${currentUser}/avatar`}
              alt={currentUser}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm text-white font-medium">
            {currentUser ? `@${currentUser}` : 'Anonymous'}
          </div>
          {parentAuthor && (
            <div className="text-xs text-gray-400">Replying to @{parentAuthor}</div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-700 pb-2">
        {!hideBold && (
          <button type="button" onClick={() => insertAtCursor('**', '**')} className={toolbarBtnClass} title="Bold" disabled={isSubmitting}>
            <Bold className="h-4 w-4" />
          </button>
        )}
        {!hideItalic && (
          <button type="button" onClick={() => insertAtCursor('*', '*')} className={toolbarBtnClass} title="Italic" disabled={isSubmitting}>
            <Italic className="h-4 w-4" />
          </button>
        )}
        {!hideLink && (
          <button type="button" onClick={() => insertAtCursor('[', '](url)')} className={toolbarBtnClass} title="Link" disabled={isSubmitting}>
            <Link className="h-4 w-4" />
          </button>
        )}
        {!hideImage && ecencyToken && (
          <ImageUploader
            onImageUploaded={(url) => insertText(`![Image](${url})`)}
            ecencyToken={ecencyToken}
            disabled={isSubmitting}
          />
        )}
        {!hideAudio && threeSpeakApiKey && (
          <AudioUploader
            onAudioUploaded={(url, duration) => { setAudioEmbedUrl(url); setAudioDuration(duration); }}
            username={currentUser}
            threeSpeakApiKey={threeSpeakApiKey}
            disabled={isSubmitting}
          />
        )}
        {!hideVideo && threeSpeakApiKey && (
          <VideoUploader
            onVideoUploaded={(embedUrl, _uploadUrl, _aspectRatio, localFile) => {
              setVideoEmbedUrl(embedUrl);
              if (localFile) setVideoPreviewUrl(URL.createObjectURL(localFile));
            }}
            username={currentUser}
            ecencyToken={ecencyToken}
            threeSpeakApiKey={threeSpeakApiKey}
            disabled={isSubmitting}
          />
        )}
        {!hideEmoji && (
          <button type="button" onClick={() => setIsEmojiOpen(true)} className={toolbarBtnClass} title="Emoji" disabled={isSubmitting}>
            <Smile className="h-4 w-4" />
          </button>
        )}
        {!hideGif && giphyApiKey && (
          <button type="button" onClick={() => setIsGiphyOpen(true)} className={`${toolbarBtnClass} text-xs font-bold px-2`} title="GIF" disabled={isSubmitting}>
            GIF
          </button>
        )}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSubmitting}
        rows={4}
        className="w-full min-h-[100px] max-h-[300px] p-3 border border-gray-700 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white placeholder-gray-500 transition-colors duration-200 disabled:opacity-50 text-sm"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />

      {/* Audio attachment preview */}
      {audioEmbedUrl && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          <iframe src={audioEmbedUrl} title="Audio preview" className="h-20 w-full border-0" allow="autoplay" />
          <div className="flex items-center gap-2 border-t border-gray-700 px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-gray-400">
              Audio attached{audioDuration > 0 ? ` (${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')})` : ''}
            </span>
            <button type="button" onClick={removeAudio} className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-400" title="Remove audio">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Video attachment preview */}
      {videoEmbedUrl && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          {videoPreviewUrl ? (
            <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: '200px' }} />
          ) : (
            <div className="h-20 flex items-center justify-center text-gray-400 text-xs">Video attached</div>
          )}
          <div className="flex items-center gap-2 border-t border-gray-700 px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-gray-400">Video attached</span>
            <button type="button" onClick={removeVideo} className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-400" title="Remove video">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-gray-500">
          {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to post
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !body.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center space-x-2"
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

      {/* Modals */}
      <GiphyPicker
        isOpen={isGiphyOpen}
        onClose={() => setIsGiphyOpen(false)}
        onSelectGif={(url) => { insertText(`![GIF](${url})`); setIsGiphyOpen(false); }}
        giphyApiKey={giphyApiKey}
      />
      <EmojiPicker
        isOpen={isEmojiOpen}
        onClose={() => setIsEmojiOpen(false)}
        onSelectEmoji={(emoji) => { insertText(emoji); setIsEmojiOpen(false); }}
      />
    </div>
  );
};

export default AddCommentInput;
