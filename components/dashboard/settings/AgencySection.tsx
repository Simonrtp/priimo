'use client';

import { useState } from 'react';

const inputClass =
  'w-full border border-[#E5E5E5] rounded-[6px] text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100';

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}

function Field({ label, type = 'text', value, onChange }: FieldProps) {
  return (
    <div>
      <label
        className="block font-medium text-gray-700"
        style={{ fontSize: '13px', marginBottom: '6px' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={{ padding: '10px 14px', fontSize: '14px' }}
      />
    </div>
  );
}

export default function AgencySection() {
  const [name, setName] = useState('Agence Test');
  const [email, setEmail] = useState('contact@agencetest.fr');
  const [phone, setPhone] = useState('01 42 00 00 00');

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[8px] p-6">
      <p className="font-semibold tracking-tight text-gray-900 mb-6" style={{ fontSize: '20px' }}>
        Mon agence
      </p>

      <div className="flex flex-col gap-4">
        <Field label="Nom de l'agence" value={name} onChange={setName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Téléphone" type="tel" value={phone} onChange={setPhone} />
      </div>
    </div>
  );
}
