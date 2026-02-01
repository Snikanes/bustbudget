import { X } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome to Budgetbyte
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-lg font-medium text-gray-800">
            Give every kroner a job.
          </p>

          <p className="text-gray-600">
            Most budgeting apps track where your money <em>went</em>. Budgetbyte
            helps you decide where it <em>goes</em>.
          </p>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-800">How it works:</h3>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </span>
                <div>
                  <p className="font-medium text-gray-800">Add your accounts</p>
                  <p className="text-sm text-gray-600">
                    Add your bank accounts and credit cards to see your total
                    available money.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </span>
                <div>
                  <p className="font-medium text-gray-800">Assign your money</p>
                  <p className="text-sm text-gray-600">
                    Every kroner you have gets assigned to a category: rent,
                    groceries, savings, fun money. When the money runs out in a
                    category, you're done spending there.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </span>
                <div>
                  <p className="font-medium text-gray-800">
                    Spend with confidence
                  </p>
                  <p className="text-sm text-gray-600">
                    Before you buy something, check the category. If there's
                    money available, spend guilt-free. If not, move money from
                    another category or wait.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">The result?</p>
            <p className="text-green-700 text-sm mt-1">
              No more wondering if you can afford something. No more
              end-of-month surprises. Just a clear picture of what your money is
              for.
            </p>
          </div>

          <p className="text-sm text-gray-500">
            Budgetbyte is based on the YNAB budgeting method. For a deeper dive,
            check out{' '}
            <a
              href="https://www.ynab.com/guide/the-ultimate-get-started-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              YNAB's Ultimate Get Started Guide
            </a>
            .
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeModal;
