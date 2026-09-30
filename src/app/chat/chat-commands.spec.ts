import { parseCommand } from './chat-commands';

describe('parseCommand', () => {
  it('passes plain text through', () => {
    expect(parseCommand('  make a landing page ')).toEqual({ message: 'make a landing page' });
  });

  it('switches the mode and keeps the rest as the message', () => {
    expect(parseCommand('/agent add a footer')).toEqual({ mode: 'agent', message: 'add a footer' });
    expect(parseCommand('/PLAN\nnew idea')).toEqual({ mode: 'plan', message: 'new idea' });
  });

  it('only switches the mode for a bare command', () => {
    expect(parseCommand('/plan')).toEqual({ mode: 'plan', message: '' });
  });

  it('sends unknown commands as text', () => {
    expect(parseCommand('/deploy now')).toEqual({ message: '/deploy now' });
  });
});
