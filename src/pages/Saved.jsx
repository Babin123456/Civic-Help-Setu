import { useState, useEffect, useMemo } from 'react';
import { getAllServices } from '../services/serviceCatalog';
import { BookmarkMinus, Bookmark, Search, Layers, Sparkles, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getSavedItems,
  updateItem,
  removeItem,
  clearAllSaved,
  toggleFavoriteItem,
} from '../services/savedStorage';
import {
  getAllReminders,
  calculateDaysRemaining,
} from '../services/reminderNotificationService';
import CollectionSwitcher from '../components/saved/CollectionSwitcher';
import CollectionEmptyState from '../components/saved/CollectionEmptyState';
import ServiceNoteModal from '../components/saved/ServiceNoteModal';
import SavedEmptyState from '../components/saved/SavedEmptyState';
import SavedItemCard from '../components/saved/SavedItemCard';
import ReminderScheduleModal from '../components/saved/ReminderScheduleModal';
import FavoritesQuickBar from '../components/saved/FavoritesQuickBar';
import {
  ALL_COLLECTION,
  buildCollections,
  isInCollection,
  resolveActiveCollection,
} from '../services/savedCollections';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmationDialogContext';

const Saved = () => {
  const { toast } = useToast();
  const confirm = useConfirm();
  // Built-in guides plus the ones the admin saved, read once when the page opens.
  // Archived guides are kept so an existing saved reference still resolves (shown as retired).
  const [allServices] = useState(() => getAllServices({ includeArchived: true }));
  const [savedItems, setSavedItems] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(ALL_COLLECTION);
  // Collections created before any guide is assigned; session-only (not persisted).
  const [pendingCollections, setPendingCollections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);

  // Modals state
  const [editingModal, setEditingModal] = useState({ isOpen: false, item: null, service: null });
  const [reminderModal, setReminderModal] = useState({ isOpen: false, service: null });

  useEffect(() => {
    setSavedItems(getSavedItems());
    setReminders(getAllReminders());
  }, []);

  const collections = useMemo(
    () => buildCollections(savedItems, pendingCollections),
    [savedItems, pendingCollections]
  );
  // If the active collection vanished (its last guide was removed or moved), show "All".
  const activeCollection = resolveActiveCollection(activeFolder, collections);
  const activeCollectionInfo = collections.find((c) => c.name === activeCollection);
  const folders = useMemo(
    () => collections.filter((c) => c.name !== ALL_COLLECTION).map((c) => c.name),
    [collections]
  );

  const handleCreateCollection = (name) => {
    setPendingCollections((prev) => [...prev, name]);
    setActiveFolder(name);
    toast?.success?.(`Collection "${name}" created. Move a guide into it using Notes.`);
  };

  const handleEditNotes = (item, service) => {
    setEditingModal({ isOpen: true, item, service });
  };

  const handleScheduleReminder = (service) => {
    setReminderModal({ isOpen: true, service });
  };

  const handleToggleFavorite = (serviceId) => {
    const updated = toggleFavoriteItem(serviceId);
    setSavedItems(updated);
    const item = updated.find((i) => i.serviceId === serviceId);
    if (item?.isFavorite) {
      toast?.info?.('Service marked as favorite.');
    } else {
      toast?.info?.('Removed from favorites.');
    }
  };

  const handleSaveNotes = (serviceId, updates) => {
    const updated = updateItem(serviceId, updates);
    setSavedItems(updated);
    toast?.success?.('Notes and folder details updated.');
  };

  const handleRemoveItem = async (serviceId) => {
    const service = allServices.find((s) => s.id === serviceId);
    const serviceName = service?.name || 'this service guide';

    const shouldRemove = await confirm({
      title: 'Remove Saved Guide?',
      message: `Are you sure you want to remove "${serviceName}" from your saved guides? Any custom notes or reminders attached to this guide will be detached.`,
      itemName: serviceName,
      confirmLabel: 'Remove Guide',
      cancelLabel: 'Cancel',
      variant: 'warning',
    });

    if (!shouldRemove) return;

    const updated = removeItem(serviceId);
    setSavedItems(updated);
    toast?.info?.('Service guide removed from saved hub.');
  };

  const handleReminderUpdated = () => {
    setReminders(getAllReminders());
  };

  const clearSaved = async () => {
    const shouldClear = await confirm({
      title: 'Clear All Saved Guides?',
      message: 'Are you sure you want to clear your entire saved guides collection? All custom folder organization and reminders will be reset.',
      confirmLabel: 'Clear All Guides',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });

    if (!shouldClear) return;

    const reset = clearAllSaved();
    setSavedItems(reset);
    toast?.info?.('All saved service guides cleared.');
  };

  // Match saved items with mock services
  const populatedItems = useMemo(() => {
    return savedItems
      .map((item) => {
        const service = allServices.find((s) => s.id === item.serviceId);
        const reminder = reminders.find((r) => r.serviceId === item.serviceId) || null;
        return service ? { item, service, reminder } : null;
      })
      .filter(Boolean);
  }, [allServices, savedItems, reminders]);

  // Filter by folder, search query, favorites, and upcoming deadlines
  const filteredItems = useMemo(() => {
    return populatedItems.filter(({ item, service, reminder }) => {
      // Favorites filter
      if (showFavoritesOnly && !item.isFavorite) {
        return false;
      }

      // Upcoming deadline filter (due in <= 14 days)
      if (showUpcomingOnly) {
        if (!reminder?.deadlineDate) return false;
        const daysLeft = calculateDaysRemaining(reminder.deadlineDate);
        if (daysLeft == null || daysLeft < 0 || daysLeft > 14) return false;
      }

      // Folder filter
      const matchesFolder = isInCollection(item, activeCollection);

      // Query filter
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        service.name.toLowerCase().includes(q) ||
        service.category.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesFolder && matchesQuery;
    });
  }, [populatedItems, activeCollection, searchQuery, showFavoritesOnly, showUpcomingOnly]);

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '2rem',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--accent-main)',
                fontSize: '0.85rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '0.35rem',
              }}
            >
              <Bookmark size={16} /> Personal Bookmark & Reminder Hub
            </div>
            <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: '800' }}>
              Saved Guides & Reminders
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
              Organize saved civic roadmaps into custom folders, attach notes, and track periodic renewal deadlines.
            </p>
          </div>

          {populatedItems.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={clearSaved}
                className="btn btn-secondary"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  color: 'var(--error, #ef4444)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <BookmarkMinus size={15} /> Clear All
              </button>
            </div>
          )}
        </div>

        {/* Favorites & Reminders Quick Bar */}
        {populatedItems.length > 0 && (
          <FavoritesQuickBar
            savedItems={savedItems}
            reminders={reminders}
            showFavoritesOnly={showFavoritesOnly}
            onToggleFavoritesOnly={() => setShowFavoritesOnly((prev) => !prev)}
            showUpcomingOnly={showUpcomingOnly}
            onToggleUpcomingOnly={() => setShowUpcomingOnly((prev) => !prev)}
          />
        )}

        {/* Folder Tabs & Search Toolbar */}
        {populatedItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <CollectionSwitcher
              collections={collections}
              activeCollection={activeCollection}
              onSelect={setActiveFolder}
              onCreate={handleCreateCollection}
            />

            {/* Quick Search */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                type="text"
                placeholder="Search notes or guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '2.4rem',
                  paddingRight: '0.85rem',
                  paddingTop: '0.45rem',
                  paddingBottom: '0.45rem',
                  fontSize: '0.85rem',
                  width: '100%',
                }}
              />
            </div>
          </div>
        )}

        {populatedItems.length > 0 && (
          <p className="collection-help">
            Each guide is kept in one collection (its folder), so nothing is duplicated and removing a guide
            updates every collection. Collections are saved with your guides; a new empty collection lasts only
            until you reload.
          </p>
        )}

        {/* Main Content Area */}
        {populatedItems.length === 0 ? (
          <SavedEmptyState />
        ) : activeCollectionInfo?.count === 0 ? (
          <CollectionEmptyState
            collectionName={activeCollection}
            onShowAll={() => setActiveFolder(ALL_COLLECTION)}
          />
        ) : filteredItems.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--glass-bg)',
              border: '1px dashed var(--border-main)',
            }}
          >
            <Search size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
              No Guides Match Your Filter
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              No saved items found in {activeCollection === ALL_COLLECTION ? 'your saved guides' : `collection "${activeCollection}"`} matching your current filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveFolder(ALL_COLLECTION);
                setSearchQuery('');
                setShowFavoritesOnly(false);
                setShowUpcomingOnly(false);
              }}
              className="btn btn-secondary"
            >
              Reset All Saved Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredItems.map(({ item, service, reminder }) => (
              <SavedItemCard
                key={service.id}
                item={item}
                service={service}
                reminder={reminder}
                onEditNotes={handleEditNotes}
                onScheduleReminder={handleScheduleReminder}
                onToggleFavorite={handleToggleFavorite}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>
        )}

        {/* Edit Notes Modal */}
        <ServiceNoteModal
          isOpen={editingModal.isOpen}
          onClose={() => setEditingModal({ isOpen: false, item: null, service: null })}
          item={editingModal.item}
          service={editingModal.service}
          existingFolders={folders}
          onSave={handleSaveNotes}
        />

        {/* Schedule Reminder Modal */}
        <ReminderScheduleModal
          isOpen={reminderModal.isOpen}
          onClose={() => setReminderModal({ isOpen: false, service: null })}
          service={reminderModal.service}
          onReminderUpdated={handleReminderUpdated}
        />
      </div>
    </div>
  );
};

export default Saved;
