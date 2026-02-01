import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import WelcomeModal from './WelcomeModal';

const WELCOME_SEEN_KEY = 'budgetbyte-welcome-seen';

function HelpButton() {
  const [showModal, setShowModal] = useState(false);

  // Show modal automatically on first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!hasSeenWelcome) {
      setShowModal(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="How to use Budgetbyte"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {showModal && <WelcomeModal onClose={handleClose} />}
    </>
  );
}

export default HelpButton;
