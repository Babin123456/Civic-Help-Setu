import React from 'react';
import { Link as LinkIcon, Code, Heart, Shield } from 'lucide-react';

const OpenSource = () => {
  return (
    <div className="container max-w-4xl pt-20 pb-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Why Civic Help Setu is Open Source</h1>
        <p className="text-xl text-muted">
          Public-service information should be accessible, understandable, and community maintained.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="card text-center p-8">
          <div className="mx-auto w-16 h-16 bg-accent-light text-accent rounded-full flex items-center justify-center mb-4">
            <Heart size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Community Driven</h3>
          <p className="text-muted">
            By making our code and data open, anyone can contribute to translating complex government jargon into plain language.
          </p>
        </div>
        
        <div className="card text-center p-8">
          <div className="mx-auto w-16 h-16 bg-accent-light text-accent rounded-full flex items-center justify-center mb-4">
            <Shield size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Transparent & Private</h3>
          <p className="text-muted">
            You can verify exactly how we handle your data. We don't store personal information or track your civic inquiries.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4 border-b border-light pb-2">Contributing</h2>
          <p className="mb-4">
            We welcome contributions from developers, designers, and citizens who want to help make public services easier to understand.
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-6">
            <li><strong>Code:</strong> Help us improve the React platform.</li>
            <li><strong>Data:</strong> Add new service guides or update existing ones.</li>
            <li><strong>Design:</strong> Improve accessibility and user experience.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 border-b border-light pb-2">Links</h2>
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <LinkIcon size={18} /> GitHub Repository
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Code size={18} /> Documentation
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OpenSource;
