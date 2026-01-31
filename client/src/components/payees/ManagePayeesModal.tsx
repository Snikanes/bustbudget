import { useState, useEffect, FormEvent } from 'react';
import { X, Search, Plus, Trash2, Pencil, Check } from 'lucide-react';
import {
  usePayees,
  usePayeeDetails,
  useUpdatePayee,
  useDeletePayee,
} from '@/hooks/queries/usePayees';
import {
  useCreateImportPayeeMapping,
  useDeleteImportPayeeMapping,
} from '@/hooks/queries/useImportPayeeMappings';

interface ManagePayeesModalProps {
  onClose: () => void;
}

function ManagePayeesModal({ onClose }: ManagePayeesModalProps) {
  const { data: payees } = usePayees();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayeeId, setSelectedPayeeId] = useState<string | null>(null);

  const filteredPayees = payees?.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Manage Payees</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Payee List */}
          <div className="w-64 border-r border-gray-200 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                />
              </div>
            </div>

            {/* Payee Count */}
            <div className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100">
              Payees ({filteredPayees?.length ?? 0})
            </div>

            {/* Payee List */}
            <div className="flex-1 overflow-y-auto">
              {filteredPayees?.map((payee) => (
                <button
                  key={payee.id}
                  onClick={() => setSelectedPayeeId(payee.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    selectedPayeeId === payee.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  {payee.name}
                </button>
              ))}
              {filteredPayees?.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No payees found
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Payee Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedPayeeId ? (
              <PayeeDetails
                payeeId={selectedPayeeId}
                onDeleted={() => setSelectedPayeeId(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a payee to view details
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface PayeeDetailsProps {
  payeeId: string;
  onDeleted: () => void;
}

function PayeeDetails({ payeeId, onDeleted }: PayeeDetailsProps) {
  const { data: payee, isLoading } = usePayeeDetails(payeeId);
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();
  const createMapping = useCreateImportPayeeMapping();
  const deleteMapping = useDeleteImportPayeeMapping();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [newRule, setNewRule] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  if (!payee) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Payee not found
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditName(payee.name);
    setIsEditing(true);
    setError(null);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      setError('Payee name cannot be empty');
      return;
    }

    updatePayee.mutate(
      { id: payeeId, name: editName.trim() },
      {
        onSuccess: () => {
          setIsEditing(false);
          setError(null);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to update payee');
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setError(null);
  };

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete "${payee.name}"? This will remove the payee from ${payee.transactionCount} transaction(s).`
      )
    ) {
      deletePayee.mutate(payeeId, {
        onSuccess: () => {
          onDeleted();
        },
      });
    }
  };

  const handleAddRule = (e: FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;

    createMapping.mutate(
      { originalPayee: newRule.trim(), payeeId },
      {
        onSuccess: () => {
          setNewRule('');
        },
      }
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    deleteMapping.mutate(ruleId);
  };

  return (
    <div className="p-4">
      {/* Payee Name */}
      <div className="mb-6">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold text-gray-900 bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  handleCancelEdit();
                }
              }}
            />
            <button
              onClick={handleSaveEdit}
              disabled={updatePayee.isPending}
              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Save"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{payee.name}</h3>
            <button
              onClick={handleStartEdit}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Edit name"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      {/* Transaction Count */}
      <div className="mb-6 text-sm text-gray-600">
        Transactions: {payee.transactionCount}
      </div>

      {/* Divider */}
      <hr className="mb-6" />

      {/* Renaming Rules */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Renaming Rules</h4>
        <p className="text-xs text-gray-500 mb-4">
          Imported payees matching these rules will be renamed to this payee.
        </p>

        {/* Add new rule */}
        <form onSubmit={handleAddRule} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="Enter import payee name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
          />
          <button
            type="submit"
            disabled={!newRule.trim() || createMapping.isPending}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Add rule"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Rule list */}
        <div className="space-y-2">
          {payee.renamingRules.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No renaming rules</p>
          ) : (
            payee.renamingRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded border border-gray-200"
              >
                <span className="text-sm font-mono text-gray-900">{rule.originalPayee}</span>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  disabled={deleteMapping.isPending}
                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Payee */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={handleDelete}
          disabled={deletePayee.isPending}
          className="px-4 py-2 text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deletePayee.isPending ? 'Deleting...' : 'Delete Payee'}
        </button>
      </div>
    </div>
  );
}

export default ManagePayeesModal;
