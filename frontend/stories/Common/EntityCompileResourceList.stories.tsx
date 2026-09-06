import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import EntityCompileResourceList, {
  type EntityCompileEntry,
} from "../../components/common/EntityCompileResourceList";

const meta = {
  title: "Common/EntityCompileResourceList",
  component: EntityCompileResourceList,
  decorators: [
    (Story) => (
      <div className="p-4 bg-gw-chrome w-[340px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityCompileResourceList>;

export default meta;

type Story = StoryObj<typeof meta>;

const mixedEntries: EntityCompileEntry[] = [
  { resourceId: "r1", name: "Opening Scene", resourceType: "text" },
  { resourceId: "r2", name: "Rising Action", resourceType: "text" },
  { resourceId: "r3", name: "Character Portrait", resourceType: "image" },
  { resourceId: "r4", name: "Closing Scene", resourceType: "text" },
];

export const MixedSample: Story = { args: { entries: mixedEntries } };

export const AllText: Story = {
  args: {
    entries: [
      { resourceId: "r1", name: "Prologue", resourceType: "text" },
      { resourceId: "r2", name: "Chapter 1", resourceType: "text" },
      { resourceId: "r3", name: "Epilogue", resourceType: "text" },
    ],
  },
};

export const Empty: Story = { args: { entries: [] } };
