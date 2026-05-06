"use client";
import { useState, useRef, useEffect } from "react";
import { SavedConversation } from "@/hooks/useConversationHistory";

interface Props {
  conversations:      SavedConversation[];
  activeId:           string | null;
  onSelect:           (conv: SavedConversation) => void;
  onNew:              () => void;
  onDelete:           (id: string) => void;
  onRename:           (id: string, title: string) => void;
  onExport:           (id: string) => void;
  onImport:           (file: File) => void;
}

function timeAgo(ts: number): string {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, onRename, onExport, onImport,
}: Props) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuId,       setMenuId]       = useState<string | null>(null);
  const [collapsed,    setCollapsed]    = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking anywhere outside
  useEffect(() => {
    if (!menuId) return;
    const handler = () => setMenuId(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuId]);

  const startEdit = (conv: SavedConversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setMenuId(null);
  };

  const commitEdit = (id: string) => {
    if (editingTitle.trim()) onRename(id, editingTitle.trim());
    setEditingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
  };

  if (collapsed) {
    return (
      <aside className="sidebar-collapsed">
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        <style jsx>{`
          .sidebar-collapsed {
            width: 40px;
            min-width: 40px;
            height: 100vh;
            background: var(--color-surface);
            border-right: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: var(--space-3);
          }
          .collapse-btn {
            width: 28px;
            height: 28px;
            border-radius: var(--radius-md);
            background: transparent;
            color: var(--color-text-muted);
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            transition: background var(--transition-interactive), color var(--transition-interactive);
          }
          .collapse-btn:hover {
            background: var(--color-surface-offset);
            color: var(--color-text);
          }
        `}</style>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">🎓 Sage</span>
        <div className="sidebar-header-actions">
          <button className="icon-btn" onClick={onNew} title="New conversation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button className="icon-btn" onClick={() => setCollapsed(true)} title="Collapse sidebar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="btn-import" onClick={() => importRef.current?.click()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import session
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      <nav className="sidebar-list">
        {conversations.length === 0 && (
          <p className="sidebar-empty">
            No saved conversations yet.
            <br />
            Start chatting to save your first session.
          </p>
        )}

        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`sidebar-item ${conv.id === activeId ? "active" : ""} ${menuId === conv.id ? "menu-open" : ""}`}
            onClick={() => {
              if (menuId === conv.id) return;
              onSelect(conv);
            }}
          >
            {editingId === conv.id ? (
              <input
                className="sidebar-rename-input"
                value={editingTitle}
                autoFocus
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={() => commitEdit(conv.id)}
                onKeyDown={e => {
                  if (e.key === "Enter")  commitEdit(conv.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="sidebar-item-title">{conv.title}</div>
                <div className="sidebar-item-meta">
                  <span className="sidebar-lang">{conv.language}</span>
                  <span>{timeAgo(conv.updatedAt)}</span>
                </div>
              </>
            )}

            {/* ── Three-dot menu ──────────────────────────────────── */}
            <div
              className="sidebar-menu-wrap"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="sidebar-menu-btn"
                onMouseDown={e => {
                  e.stopPropagation();
                  setMenuId(menuId === conv.id ? null : conv.id);
                }}
                title="Options"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5"  r="1"/>
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </button>

              {menuId === conv.id && (
                <div
                  className="sidebar-dropdown"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                >
                  <button onMouseDown={() => startEdit(conv)}>Rename</button>
                  <button onMouseDown={() => { onExport(conv.id); setMenuId(null); }}>Export JSON</button>
                  <button
                    className="danger"
                    onMouseDown={() => { onDelete(conv.id); setMenuId(null); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </nav>

      <style jsx>{`
        .sidebar {
          width: 260px;
          min-width: 260px;
          height: 100vh;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-3) var(--space-3);
          border-bottom: 1px solid var(--color-divider);
        }

        .sidebar-logo {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-text);
          letter-spacing: -0.01em;
        }

        .sidebar-header-actions {
          display: flex;
          gap: var(--space-1);
        }

        .icon-btn {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: background var(--transition-interactive), color var(--transition-interactive);
        }

        .icon-btn:hover {
          background: var(--color-surface-offset);
          color: var(--color-text);
        }

        .sidebar-actions {
          padding: var(--space-2) var(--space-3) var(--space-1);
        }

        .btn-import {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          background: var(--color-surface-offset);
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: background var(--transition-interactive), color var(--transition-interactive);
        }

        .btn-import:hover {
          background: var(--color-surface-dynamic);
          color: var(--color-text);
        }

        /* KEY FIX: overflow-y auto + overflow-x visible so dropdowns aren't clipped */
        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: visible;
          padding: var(--space-1) var(--space-2);
        }

        .sidebar-list::-webkit-scrollbar       { width: 4px; }
        .sidebar-list::-webkit-scrollbar-thumb { background: var(--color-divider); border-radius: 2px; }

        .sidebar-empty {
          font-size: var(--text-xs);
          color: var(--color-text-faint);
          text-align: center;
          padding: var(--space-8) var(--space-4);
          line-height: 1.6;
        }

        .sidebar-item {
          position: relative;
          padding: var(--space-2) 32px var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          cursor: pointer;
          margin-bottom: 2px;
          transition: background var(--transition-interactive);
          /* KEY FIX: items with open menus sit above their siblings */
          z-index: 0;
        }

        .sidebar-item:hover   { background: var(--color-surface-offset); }
        .sidebar-item.active  { background: var(--color-surface-offset-2); }

        /* Raise the item whose menu is open above all other items */
        .sidebar-item.menu-open { z-index: 10; }

        .sidebar-item-title {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
        }

        .sidebar-item.active .sidebar-item-title,
        .sidebar-item:hover  .sidebar-item-title { color: var(--color-text); }

        .sidebar-item-meta {
          display: flex;
          gap: var(--space-2);
          font-size: 10px;
          color: var(--color-text-faint);
          margin-top: 3px;
        }

        .sidebar-lang {
          background: var(--color-surface-dynamic);
          color: var(--color-text-muted);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sidebar-rename-input {
          width: 100%;
          background: var(--color-surface-offset);
          border: 1px solid var(--color-primary);
          border-radius: var(--radius-sm);
          color: var(--color-text);
          font-size: var(--text-xs);
          padding: 2px var(--space-2);
          outline: none;
        }

        .sidebar-menu-wrap {
          position: absolute;
          right: var(--space-1);
          top: 50%;
          transform: translateY(-50%);
          /* KEY FIX: ensure wrap stacks above its own item content */
          z-index: 1;
        }

        .sidebar-menu-btn {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-faint);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          opacity: 0;
          transition:
            opacity var(--transition-interactive),
            background var(--transition-interactive),
            color var(--transition-interactive);
        }

        .sidebar-item:hover .sidebar-menu-btn,
        .sidebar-item.active .sidebar-menu-btn,
        .sidebar-item.menu-open .sidebar-menu-btn { opacity: 1; }

        .sidebar-menu-btn:hover {
          background: var(--color-surface-dynamic);
          color: var(--color-text);
        }

        /* KEY FIX: high z-index so dropdown floats above ALL sibling items */
        .sidebar-dropdown {
          position: absolute;
          right: 0;
          top: 28px;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          min-width: 140px;
          z-index: 999;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }

        .sidebar-dropdown button {
          display: block;
          width: 100%;
          text-align: left;
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          background: none;
          border: none;
          cursor: pointer;
          transition: background var(--transition-interactive), color var(--transition-interactive);
        }

        .sidebar-dropdown button:hover {
          background: var(--color-surface-offset);
          color: var(--color-text);
        }

        .sidebar-dropdown button.danger           { color: var(--color-error); }
        .sidebar-dropdown button.danger:hover {
          background: var(--color-error-highlight);
        }
      `}</style>
    </aside>
  );
}