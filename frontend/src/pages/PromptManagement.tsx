import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import type { ApiPromptVersion } from '../services/api';

export const PromptManagement: React.FC = () => {
  const [prompts, setPrompts] = useState<ApiPromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContent, setNewContent] = useState('');

  const loadPrompts = async () => {
    try {
      const res = await api.getPrompts();
      setPrompts(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handlePublish = async (id: string) => {
    try {
      await api.publishPromptVersion(id);
      loadPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPromptVersion(newContent);
      setNewContent('');
      setShowCreateModal(false);
      loadPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="mb-2">Prompt Engine Console</h1>
          <p>Draft, publish, and rollback active system prompt configurations.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Draft New Prompt</Button>
      </div>

      {loading ? (
        <p>Loading prompt histories...</p>
      ) : (
        <Table headers={['Version', 'System Instruct Content', 'Created By', 'Status', 'Actions']}>
          {prompts.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>v{p.version}</td>
              <td style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.content}
              </td>
              <td>{p.author}</td>
              <td>
                <Badge variant={p.status === 'published' ? 'success' : p.status === 'draft' ? 'primary' : 'danger'}>
                  {p.status}
                </Badge>
              </td>
              <td>
                {p.status !== 'published' && p.status !== 'archived' && (
                  <Button variant="secondary" onClick={() => handlePublish(p.id)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Publish
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Prompt Draft Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Draft Prompt Instruction">
        <form onSubmit={handleCreate}>
          <div className="flex flex-col gap-2 w-full mb-4">
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Prompt Instructions Body
            </label>
            <textarea
              required
              rows={6}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="input"
              style={{ resize: 'vertical', fontFamily: 'monospace' }}
              placeholder="Define rules: greeting phrases, allowed clinic hours, appointment slots..."
            />
          </div>
          <Button type="submit" style={{ width: '100%' }}>
            Save Draft
          </Button>
        </form>
      </Modal>
    </div>
  );
};
