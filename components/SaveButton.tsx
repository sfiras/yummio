'use client';
import { useState } from 'react';

export default function SaveButton() {
  const [on, setOn] = useState(false);
  return (
    <button
      className={`save${on ? ' on' : ''}`}
      aria-label="שמירה"
      onClick={() => setOn((v) => !v)}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}
