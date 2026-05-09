'use client';

import { useState } from 'react';

const inputCls = 'w-full border border-black/8 rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:border-accent/40 placeholder-mute/40';

function Field({ label, type = 'text', value, onChange }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-mute font-medium mb-1.5" style={{ fontSize: 11, letterSpacing: '0.02em' }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        style={{ fontSize: 13.5 }}
      />
    </div>
  );
}

export default function AgencySection() {
  const [name,  setName]  = useState('Agence Test');
  const [email, setEmail] = useState('contact@agencetest.fr');
  const [phone, setPhone] = useState('01 42 00 00 00');

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 p-7">
      <p className="font-bold text-ink tracking-tight mb-5" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
        Mon agence
      </p>
      <div className="flex flex-col gap-4">
        <Field label="Nom de l'agence" value={name}  onChange={setName}  />
        <Field label="Email" type="email"  value={email} onChange={setEmail} />
        <Field label="Téléphone" type="tel" value={phone} onChange={setPhone} />
      </div>
    </div>
  );
}
