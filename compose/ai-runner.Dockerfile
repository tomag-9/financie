FROM node:20-alpine

RUN npm install --global @anthropic-ai/claude-code @openai/codex

COPY compose/ai-runner-entrypoint.sh /usr/local/bin/ai-runner-entrypoint
RUN chmod +x /usr/local/bin/ai-runner-entrypoint

ENTRYPOINT ["ai-runner-entrypoint"]
CMD ["sh"]
