import { MessageCard } from './MessageCard.jsx';

export function MessageGrid({ messages, onOpenPhoto }) {
  return (
    <div className="memory-wall-grid">
      {messages.map((message, index) => {
        const layout = index === 0
          ? 'feature'
          : !message.photo_url
            ? 'note'
            : index % 2 === 0
              ? 'landscape'
              : 'portrait';

        return (
          <MessageCard
            key={message.id}
            message={message}
            layout={layout}
            onOpenPhoto={onOpenPhoto}
          />
        );
      })}
    </div>
  );
}