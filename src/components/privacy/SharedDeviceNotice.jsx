import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

/**
 * Plain notice shown where records are saved in the browser (#212). Says what is kept, that the
 * next person on a shared device may see it, and where to delete it.
 */
const SharedDeviceNotice = ({ what = 'records' }) => (
  <aside className="sdn" aria-label="Shared device notice">
    <Info size={18} aria-hidden="true" className="sdn__icon" />
    <p className="sdn__text">
      Your {what} are saved in this browser only. If other people use this device, they may be able to see them.
      Use a private window on a shared device, or delete your data from{' '}
      <Link to="/privacy">Clear my data</Link> when you are done.
    </p>
  </aside>
);

export default SharedDeviceNotice;
