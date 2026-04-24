import { useRef, useCallback, useEffect } from 'react';
import { Editor as TinyMCEEditor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditorType } from 'tinymce';
import { client } from '@/lib/api';
import { fetchWithRetry } from '@/lib/retry';
import DOMPurify from 'dompurify';



// ─── Storage Buckets ───
const IMAGE_BUCKET = 'article-images';
const VIDEO_BUCKET = 'article-videos';

// ─── Size Limits ───
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// ─── Accepted MIME types ───
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/webm,video/ogg';

/** Format bytes into a human-readable string */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  height?: number;
  /** If true, sanitize on every change (default: false, sanitize on getCleanHTML) */
  sanitizeOnChange?: boolean;
}

/** Allowed tags and attributes for DOMPurify sanitization */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div',
    'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
    'img', 'figure', 'figcaption', 'pre', 'code', 'hr', 'sub', 'sup',
    'video', 'source', 'audio',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'class', 'style', 'src', 'alt',
    'width', 'height', 'colspan', 'rowspan', 'scope', 'id', 'data-article-id',
    'loading', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'poster', 'type',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

/** Sanitize HTML string with DOMPurify */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/**
 * Upload a file to object storage and return the download URL.
 * Shows TinyMCE notifications for progress, success, and errors.
 */
async function uploadFileToStorage(
  file: File,
  bucket: string,
  prefix: string,
  editor: TinyMCEEditorType | null
): Promise<string> {
  const sizeStr = formatFileSize(file.size);
  const mediaType = file.type.startsWith('video/') ? 'Video' : 'Image';

  // Show uploading notification
  const notification = editor?.notificationManager.open({
    text: `Uploading ${mediaType.toLowerCase()} "${file.name}" (${sizeStr})...`,
    type: 'info',
    timeout: 0,
    closeButton: false,
  });

  try {
    // Generate unique object key
    const ext = file.name.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
    const objectKey = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Step 1: Get presigned upload URL
    const uploadResp = await client.storage.getUploadUrl({
      bucket_name: bucket,
      object_key: objectKey,
    });

    if (!uploadResp?.data?.upload_url) {
      throw new Error('Failed to get upload URL from storage');
    }

    // Step 2: Upload file via presigned URL
    const putResp = await fetchWithRetry(uploadResp.data.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    }, { label: 'storage.upload' });

    if (!putResp.ok) {
      throw new Error(`Upload failed with status ${putResp.status}`);
    }

    // Step 3: Get download URL
    const dlResp = await client.storage.getDownloadUrl({
      bucket_name: bucket,
      object_key: objectKey,
    });

    if (!dlResp?.data?.download_url) {
      throw new Error('Failed to get download URL');
    }

    // Close uploading notification & show success
    notification?.close();
    editor?.notificationManager.open({
      text: `${mediaType} uploaded successfully (${sizeStr})`,
      type: 'success',
      timeout: 3000,
    });

    return dlResp.data.download_url;
  } catch (err) {
    notification?.close();
    const errMsg = err instanceof Error ? err.message : 'Unknown upload error';
    editor?.notificationManager.open({
      text: `${mediaType} upload failed: ${errMsg}`,
      type: 'error',
      timeout: 5000,
    });
    console.error(`TinyMCE ${mediaType.toLowerCase()} upload error:`, err);
    throw err;
  }
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  height = 400,
  sanitizeOnChange = false,
}: RichTextEditorProps) {
  const editorRef = useRef<TinyMCEEditorType | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorChange = useCallback(
    (content: string) => {
      const output = sanitizeOnChange ? sanitizeHTML(content) : content;

      // Clear existing auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Debounced auto-save notification (2s)
      autoSaveTimerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem('tinymce_draft', output);
          sessionStorage.setItem('tinymce_draft_ts', new Date().toISOString());
        } catch {
          // sessionStorage might be full or unavailable
        }
      }, 2000);

      onChange(output);
    },
    [onChange, sanitizeOnChange]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Must use Vite `import.meta.env.BASE_URL` (e.g. `/news/`) or `/tinymce/...` 404s in prod
  // and the server returns index.html — JS parser sees "<" and TinyMCE never hits `window`.
  const tinyBase = `${import.meta.env.BASE_URL}tinymce`.replace(/\/$/, '');

  return (
    <div className="rich-text-editor-wrapper">
      <TinyMCEEditor
        tinymceScriptSrc={`${tinyBase}/tinymce.min.js`}
        licenseKey="gpl"
        onInit={(_evt, editor) => {
          editorRef.current = editor;
        }}
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          base_url: tinyBase,
          suffix: '.min',
          height,
          menubar: false,
          toolbar_mode: 'wrap' as const,
          placeholder,
          branding: false,
          promotion: false,
          statusbar: true,
          elementpath: true,
          resize: true,

          // Free-tier plugins only
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'wordcount',
          ],

          // Toolbar groups
          toolbar: [
            'undo redo | cut copy paste | fontfamily fontsize | forecolor backcolor | bold italic underline strikethrough | subscript superscript | removeformat',
            'bullist numlist outdent indent | alignleft aligncenter alignright alignjustify | lineheight | searchreplace | link unlink anchor image media table | code fullscreen preview wordcount',
          ],

          // ─── Image Upload Configuration ───
          image_uploadtab: true,
          image_dimensions: true,
          image_advtab: false,
          image_description: true,
          image_class_list: [
            { title: 'Responsive (auto-fill)', value: 'responsive-img' },
            { title: 'None', value: '' },
          ],
          automatic_uploads: true,

          // ─── Media Configuration ───
          media_alt_source: false,
          media_poster: true,
          media_dimensions: true,

          // ─── File Picker: supports both image and media (video) uploads ───
          file_picker_types: 'image media',
          file_picker_callback: (callback, _value, meta) => {
            // ── IMAGE UPLOAD ──
            if (meta.filetype === 'image') {
              const input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.setAttribute('accept', ACCEPTED_IMAGE_TYPES);

              input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (!file) return;

                // Validate file type
                if (!file.type.startsWith('image/')) {
                  editorRef.current?.notificationManager.open({
                    text: 'Please select a valid image file (JPEG, PNG, GIF, WebP, SVG).',
                    type: 'error',
                    timeout: 4000,
                  });
                  return;
                }

                // Validate file size
                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                  editorRef.current?.notificationManager.open({
                    text: `Image too large: ${formatFileSize(file.size)}. Maximum allowed: ${MAX_IMAGE_SIZE_MB}MB.`,
                    type: 'error',
                    timeout: 5000,
                  });
                  return;
                }

                (async () => {
                  try {
                    const downloadUrl = await uploadFileToStorage(
                      file,
                      IMAGE_BUCKET,
                      'editor',
                      editorRef.current
                    );
                    callback(downloadUrl, {
                      alt: file.name.replace(/\.[^.]+$/, ''),
                      title: file.name,
                    });
                  } catch {
                    // Error already handled in uploadFileToStorage
                  }
                })();
              });

              input.click();
            }

            // ── VIDEO / MEDIA UPLOAD ──
            if (meta.filetype === 'media') {
              const input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.setAttribute('accept', ACCEPTED_VIDEO_TYPES);

              input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (!file) return;

                // Validate file type
                if (!file.type.startsWith('video/')) {
                  editorRef.current?.notificationManager.open({
                    text: 'Please select a valid video file (MP4, WebM, OGG).',
                    type: 'error',
                    timeout: 4000,
                  });
                  return;
                }

                // Validate file size
                if (file.size > MAX_VIDEO_SIZE_BYTES) {
                  editorRef.current?.notificationManager.open({
                    text: `Video too large: ${formatFileSize(file.size)}. Maximum allowed: ${MAX_VIDEO_SIZE_MB}MB.`,
                    type: 'error',
                    timeout: 5000,
                  });
                  return;
                }

                // Show file size info before upload starts
                const sizeStr = formatFileSize(file.size);
                editorRef.current?.notificationManager.open({
                  text: `Selected video: "${file.name}" (${sizeStr}). Uploading...`,
                  type: 'info',
                  timeout: 2000,
                });

                (async () => {
                  try {
                    const downloadUrl = await uploadFileToStorage(
                      file,
                      VIDEO_BUCKET,
                      'editor',
                      editorRef.current
                    );
                    // Return the URL to TinyMCE's media dialog Source field
                    callback(downloadUrl, {
                      title: file.name,
                    });
                  } catch {
                    // Error already handled in uploadFileToStorage
                  }
                })();
              });

              input.click();
            }
          },

          // ─── Link Configuration ───
          link_assume_external_targets: true,
          link_default_target: '_blank',
          link_title: true,
          link_class_list: [
            { title: 'Default', value: '' },
            { title: 'Internal Link', value: 'internal-link' },
            { title: 'External Link', value: 'external-link' },
          ],

          // ─── Content Styling ───
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 16px;
              line-height: 1.7;
              color: #1e293b;
              padding: 16px;
            }
            blockquote {
              border-left: 3px solid #3b82f6;
              padding-left: 16px;
              color: #64748b;
              margin: 16px 0;
              font-style: italic;
            }
            a { color: #3b82f6; text-decoration: underline; }
            a.internal-link { color: #7c3aed; }
            a.external-link { color: #2563eb; }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              display: block;
            }
            img.responsive-img {
              width: 100%;
              max-width: 100%;
              height: auto;
              object-fit: cover;
              border-radius: 8px;
              display: block;
              margin: 12px 0;
            }
            video {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              display: block;
              margin: 12px 0;
              background: #000;
            }
            table { border-collapse: collapse; width: 100%; }
            table td, table th { border: 1px solid #e2e8f0; padding: 8px 12px; }
            table th { background-color: #f8fafc; font-weight: 600; }
            pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
            h1, h2, h3, h4, h5, h6 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; }
          `,

          // Paste cleanup (free)
          paste_as_text: false,

          // Setup callback for custom behaviors
          setup: (editor) => {
            // Add keyboard shortcut Ctrl+K for link
            editor.addShortcut('meta+k', 'Insert link', () => {
              editor.execCommand('mceLink');
            });

            // Auto-add rel="noopener noreferrer" to external links
            editor.on('SetContent', () => {
              const links = editor.getBody().querySelectorAll('a[target="_blank"]');
              links.forEach((link) => {
                if (!link.getAttribute('rel')?.includes('noopener')) {
                  link.setAttribute('rel', 'noopener noreferrer');
                }
              });
            });

            // Ensure all images have responsive attributes on insert
            editor.on('SetContent', () => {
              const images = editor.getBody().querySelectorAll('img');
              images.forEach((img) => {
                if (!img.style.maxWidth) {
                  img.style.maxWidth = '100%';
                }
                if (!img.style.height || img.style.height === '0px') {
                  img.style.height = 'auto';
                }
                if (!img.getAttribute('loading')) {
                  img.setAttribute('loading', 'lazy');
                }
              });

              // Ensure all videos are responsive
              const videos = editor.getBody().querySelectorAll('video');
              videos.forEach((video) => {
                if (!video.style.maxWidth) {
                  video.style.maxWidth = '100%';
                }
                if (!video.style.height || video.style.height === '0px') {
                  video.style.height = 'auto';
                }
                if (!video.hasAttribute('controls')) {
                  video.setAttribute('controls', 'controls');
                }
                if (!video.hasAttribute('preload')) {
                  video.setAttribute('preload', 'metadata');
                }
              });
            });
          },
        }}
      />

      {/* Standard toolbar-on-top styling */}
      <style>{`
        .rich-text-editor-wrapper .tox.tox-tinymce {
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }
        .rich-text-editor-wrapper .tox .tox-editor-header {
          border-bottom: 1px solid #e2e8f0;
          border-top: none;
          background: #f8fafc;
        }
        .rich-text-editor-wrapper .tox .tox-toolbar__primary {
          background: transparent;
        }
        .rich-text-editor-wrapper .tox .tox-statusbar {
          border-top: 1px solid #e2e8f0;
        }
      `}</style>
    </div>
  );
}