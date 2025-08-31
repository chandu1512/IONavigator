import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { loginUser } from '../API/requests';
import IONLOGO from '../assets/IONLOGO.png';
import { EmailInputProps } from '../interface/interfaces';

function EmailInput({ onEmailSubmit }: EmailInputProps) {
  const { userId, setUserId } = useUser(); // keep this for backward-compat use
  const [email, setEmail] = useState<string>('');

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      // DO NOT redeclare "userId" here—use a different name
      const newUserId = await loginUser(email.trim());
      setUserId(newUserId);
      onEmailSubmit(newUserId);
    } catch (error) {
      console.error('Error logging in user:', error);
      alert('Unable to log in with that email. Check backend /api/user and try again.');
    }
  };

  return (
    <div>
      <img src={IONLOGO} alt="ION Logo" className="ion-logo" />
      <h1 className='header'>I/O Navigator</h1>
      <h2 className='subheader'>Exploring LLM-driven I/O performance diagnosis</h2>
      <p className='small-header'>
        I/O Navigator implements an LLM-driven analysis of Darshan logs to identify, describe,
        and explain I/O performance issues present within HPC applications. Enter your email below
        to get started!
      </p>

      <div className='email-input-form'>
        <form onSubmit={handleEmailSubmit} className='email-input-form'>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <button type="submit">Submit</button>
        </form>
      </div>

      <p className="email-input-footer">
        Note: Your email input and any chat interactions will be saved for research purposes.
        Your email information will not be shared anywhere.
      </p>
    </div>
  );
}

export default EmailInput;
