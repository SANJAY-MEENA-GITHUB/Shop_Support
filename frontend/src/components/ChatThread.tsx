import { MessageItem } from '../lib/types';
import { formatDateTime } from '../lib/api';

function getRoleClass(senderType: MessageItem['senderType']): string {
  switch (senderType) {
    case 'CUSTOMER':
      return 'customer';
    case 'SYSTEM':
      return 'system';
    case 'STAFF':
      return 'staff';
    default:
      return 'agent';
  }
}

function getSenderLabel(msg: MessageItem): string {
  if (msg.senderType === 'AI' || msg.senderType === 'AGENT') return 'AI Support Agent';
  if (msg.senderType === 'SYSTEM') return 'System Event';
  if (msg.senderType === 'STAFF') return msg.sender?.name ? `${msg.sender.name} (Staff)` : 'Support Staff';
  return msg.sender?.name || 'Customer';
}

export function ChatThread({ messages }: { messages: MessageItem[] }) {
  return (
    <div className="chat-thread" aria-live="polite">
      {messages.length === 0 ? (
        <p className="text-muted">No messages in this conversation yet.</p>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${getRoleClass(msg.senderType)}`}>
            <div className="chat-meta">
              <span>{getSenderLabel(msg)}</span>
              <span className="tabular">{formatDateTime(msg.createdAt)}</span>
            </div>
            <div className="chat-content">{msg.content}</div>
          </div>
        ))
      )}
    </div>
  );
}
