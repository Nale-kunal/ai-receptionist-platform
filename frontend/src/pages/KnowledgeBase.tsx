import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../services/api';

export const KnowledgeBase: React.FC = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '' });

  const loadFAQs = async () => {
    try {
      const res = await api.getFAQs();
      setFaqs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFAQs();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createFAQ(form);
      setForm({ question: '', answer: '' });
      setShowAdd(false);
      loadFAQs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="mb-2">Knowledge Base FAQs</h1>
          <p>Provide clinic policies and guidelines that the AI Receptionist uses to resolve questions.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add Policy FAQ</Button>
      </div>

      {showAdd && (
        <Card style={{ maxWidth: '600px', marginBottom: '16px' }}>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <Input
              label="Question Pattern"
              required
              placeholder="e.g. Do you have parking?"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Policy Answer
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Yes, we have free visitor parking slots in the rear driveway."
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                className="input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit">Save FAQ</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p>Loading FAQs...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>
                Q: {faq.question}
              </h3>
              <p style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>A: {faq.answer}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
