# Storybook Implementation Standards

This document applies only when implementing Storybook-related features or modifying Storybook configuration.

It does NOT to files outside of:

- frontend/.storybook
- frontend/stories

## Storybook Framework

The storybook framework we will be using (for types such as 'Meta' and 'StoryObj') is `@storybook/nextjs-vite`.

## Story Args

When creating stories for individual components, stories MUST include args.

When creating stories for pages or compositions, stories SHOULD include args if they can be cleanly passed.
