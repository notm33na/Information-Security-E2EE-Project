# Sentinel UI Design System Analysis

## Step 1: Complete Style System Summary

### **Technology Stack**

#### Core Technologies
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.17 with custom configuration
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React 0.462.0
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack React Query 5.83.0
- **Form Handling**: React Hook Form 7.61.1 with Zod validation
- **Theme**: next-themes 0.3.0 (dark mode support)

#### Key Dependencies
- **Radix UI**: Complete component library (dialogs, dropdowns, tabs, etc.)
- **Class Variance Authority**: For component variants
- **Tailwind Merge**: For conditional class merging
- **clsx**: For conditional className construction
- **Sonner**: Toast notifications
- **Recharts**: Data visualization
- **date-fns**: Date formatting

---

### **Color Palette**

#### Primary Colors (HSL-based)
- **Primary**: `hsl(187 85% 53%)` - Cyan/Teal (main brand color)
- **Primary Foreground**: `hsl(222 47% 6%)` - Very dark blue (text on primary)
- **Accent**: `hsl(187 75% 45%)` - Darker cyan
- **Accent Foreground**: `hsl(222 47% 6%)` - Very dark blue

#### Background Colors
- **Background**: `hsl(222 47% 6%)` - Very dark blue (main background)
- **Foreground**: `hsl(210 40% 96%)` - Light gray (main text)
- **Card**: `hsl(222 47% 8%)` - Slightly lighter dark blue
- **Card Foreground**: `hsl(210 40% 96%)` - Light gray

#### Semantic Colors
- **Success**: `hsl(142 70% 45%)` - Green
- **Success Foreground**: `hsl(210 40% 98%)` - Near white
- **Warning**: `hsl(38 92% 50%)` - Orange/Amber
- **Warning Foreground**: `hsl(222 47% 6%)` - Very dark blue
- **Destructive**: `hsl(0 72% 51%)` - Red
- **Destructive Foreground**: `hsl(210 40% 98%)` - Near white

#### Muted/Secondary Colors
- **Muted**: `hsl(222 30% 12%)` - Dark gray-blue
- **Muted Foreground**: `hsl(215 20% 55%)` - Medium gray
- **Secondary**: `hsl(222 30% 14%)` - Slightly lighter dark gray-blue
- **Secondary Foreground**: `hsl(210 40% 90%)` - Light gray

#### Border/Input Colors
- **Border**: `hsl(222 30% 18%)` - Medium gray-blue
- **Input**: `hsl(222 30% 14%)` - Dark gray-blue
- **Ring**: `hsl(187 85% 53%)` - Primary color (focus rings)

#### Sidebar Colors
- **Sidebar Background**: `hsl(222 47% 7%)` - Very dark blue
- **Sidebar Foreground**: `hsl(210 40% 90%)` - Light gray
- **Sidebar Primary**: `hsl(187 85% 53%)` - Primary cyan
- **Sidebar Border**: `hsl(222 30% 16%)` - Dark gray-blue

#### Custom Glow Effects
- **Glow Primary**: `0 0 20px hsl(187 85% 53% / 0.3)`
- **Glow Success**: `0 0 20px hsl(142 70% 45% / 0.3)`
- **Glow Warning**: `0 0 20px hsl(38 92% 50% / 0.3)`
- **Glow Destructive**: `0 0 20px hsl(0 72% 51% / 0.3)`

#### Gradients
- **Gradient Primary**: `linear-gradient(135deg, hsl(187 85% 53%), hsl(199 89% 48%))`
- **Gradient Dark**: `linear-gradient(180deg, hsl(222 47% 8%), hsl(222 47% 5%))`
- **Gradient Card**: `linear-gradient(145deg, hsl(222 47% 10%), hsl(222 47% 7%))`

---

### **Typography**

#### Font Families
- **Primary (Sans)**: `'Plus Jakarta Sans'` - Modern, clean sans-serif
  - Weights: 300, 400, 500, 600, 700
  - Used for: Body text, headings, UI elements
- **Monospace**: `'JetBrains Mono'` - Technical monospace
  - Weights: 400, 500, 600
  - Used for: Code, fingerprints, technical data

#### Typography Scale
- **Base Font Size**: 16px (1rem)
- **Font Sizes**: Uses Tailwind's default scale
  - `text-xs`: 0.75rem (12px)
  - `text-sm`: 0.875rem (14px)
  - `text-base`: 1rem (16px)
  - `text-lg`: 1.125rem (18px)
  - `text-xl`: 1.25rem (20px)
  - `text-2xl`: 1.5rem (24px)
  - `text-3xl`: 1.875rem (30px)
  - `text-4xl`: 2.25rem (36px)
  - `text-5xl`: 3rem (48px)

#### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

---

### **Spacing System**

Uses Tailwind's default spacing scale (4px base unit):
- `0`: 0px
- `1`: 0.25rem (4px)
- `2`: 0.5rem (8px)
- `3`: 0.75rem (12px)
- `4`: 1rem (16px)
- `5`: 1.25rem (20px)
- `6`: 1.5rem (24px)
- `8`: 2rem (32px)
- `12`: 3rem (48px)
- `16`: 4rem (64px)

Common spacing patterns:
- **Card Padding**: `p-4`, `p-5`, `p-6` (16px, 20px, 24px)
- **Component Gaps**: `gap-2`, `gap-3`, `gap-4` (8px, 12px, 16px)
- **Section Spacing**: `space-y-4`, `space-y-6` (16px, 24px vertical)
- **Container Padding**: `p-4 sm:p-6 lg:p-8` (responsive)

---

### **Border Radius**

- **Base Radius**: `0.75rem` (12px) - defined as CSS variable `--radius`
- **Large (lg)**: `var(--radius)` = 0.75rem (12px)
- **Medium (md)**: `calc(var(--radius) - 2px)` = 0.625rem (10px)
- **Small (sm)**: `calc(var(--radius) - 4px)` = 0.5rem (8px)
- **Extra Small**: `rounded-md` = 0.375rem (6px)
- **Full**: `rounded-full` (for badges, avatars)

Common patterns:
- **Cards**: `rounded-xl` (0.75rem)
- **Buttons**: `rounded-lg` (0.5rem)
- **Inputs**: `rounded-md` (0.375rem)
- **Badges**: `rounded-full`
- **Chat Bubbles**: `rounded-2xl` (1rem) with directional corners

---

### **Layout Grid System**

#### Container
- **Max Width**: 1280px (default)
- **Padding**: `2rem` (32px) on all sides
- **Breakpoint**: `2xl: 1400px`

#### Responsive Breakpoints (Tailwind defaults)
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

#### Common Grid Patterns
- **Stats Grid**: `grid grid-cols-2 lg:grid-cols-4 gap-4`
- **Content Grid**: `grid lg:grid-cols-3 gap-6`
- **File Grid**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

---

### **Component Patterns**

#### Buttons
- **Variants**:
  - `default`: Primary button with glow effect
  - `destructive`: Red/danger actions
  - `outline`: Bordered, transparent background
  - `secondary`: Secondary background
  - `ghost`: Transparent, hover background
  - `link`: Text link style
- **Sizes**: `default`, `sm`, `lg`, `xl`, `icon`, `icon-sm`, `icon-lg`
- **Features**: Shadow effects, hover states, active scale animation

#### Inputs
- **Base Style**: Rounded, bordered, with focus ring
- **Focus Ring**: Primary color with offset
- **Placeholder**: Muted foreground color
- **Icons**: Left-aligned icons with padding

#### Cards
- **Base**: Rounded, bordered, card background
- **Hover**: Border color change to primary/30
- **Padding**: `p-4`, `p-5`, or `p-6`
- **Shadow**: Subtle shadow-sm

#### Badges
- **Types**: Status badges (success, warning, danger, primary)
- **Style**: Rounded-full, small padding, colored background with opacity
- **Icons**: Optional small icons

#### Modals/Dialogs
- **Overlay**: Backdrop blur with dark overlay
- **Content**: Card-style container with rounded corners
- **Animation**: Scale-in and fade animations

---

### **Animation System**

#### Keyframe Animations
1. **accordion-down/up**: Smooth height transitions
2. **fade-in**: Opacity + translateY(10px)
3. **fade-in-up**: Opacity + translateY(20px)
4. **slide-in-left**: Opacity + translateX(-20px)
5. **slide-in-right**: Opacity + translateX(20px)
6. **scale-in**: Opacity + scale(0.95 to 1)
7. **pulse-glow**: Pulsing box-shadow for critical alerts
8. **shimmer**: Background position animation
9. **float**: Subtle vertical float animation

#### Animation Durations
- **Fast**: 0.2s (scale-in, accordion)
- **Medium**: 0.3s (slide-in)
- **Slow**: 0.4s-0.5s (fade-in)

#### Common Animation Patterns
- **Staggered Lists**: `animationDelay: ${i * 50}ms` or `${i * 100}ms`
- **Hover Effects**: `transition-all duration-200`
- **Active States**: `active:scale-[0.98]`

---

### **Navigation Patterns**

#### Desktop Sidebar
- **Width**: 256px (w-64) expanded, 64px (w-16) collapsed
- **Position**: Fixed left, full height
- **Background**: Sidebar background color
- **Border**: Right border with sidebar-border color
- **Logo**: Top section with gradient icon
- **Nav Items**: Icon + label, active state with primary accent
- **Collapse Toggle**: Bottom section
- **Security Status**: Bottom badge (when expanded)

#### Mobile Bottom Navigation
- **Position**: Fixed bottom, full width
- **Height**: 64px (h-16)
- **Background**: Card with backdrop blur
- **Items**: Icon + label, centered
- **Active State**: Primary color with background

#### Header
- **Height**: 64px (h-16)
- **Position**: Sticky top
- **Background**: Background with backdrop blur
- **Border**: Bottom border
- **Content**: Title (optional), search, notifications, security badge

---

### **Chat UI Patterns**

#### Chat List Item
- **Layout**: Avatar + content + timestamp
- **Avatar**: Gradient background with initials, online indicator
- **Content**: Name, last message, unread count
- **States**: Active, hover, unread badge
- **Encryption Indicator**: Lock icon

#### Chat Bubble
- **Sender**: Primary color background, right-aligned, rounded-br-md
- **Receiver**: Secondary background, left-aligned, rounded-bl-md
- **Max Width**: 80% mobile, 70% tablet, 60% desktop
- **Content**: Message text, timestamp, read receipts, encryption icon
- **File Attachments**: Special card-style display within bubble

#### Message Input
- **Container**: Sticky bottom, backdrop blur
- **Layout**: Attach button + textarea + send button
- **Textarea**: Auto-resize, rounded, secondary background
- **Security Badge**: "End-to-end encrypted" indicator

---

### **Icon System**

#### Library
- **Lucide React**: Primary icon library
- **Usage**: Consistent sizing (w-4 h-4, w-5 h-5, w-6 h-6)
- **Colors**: Inherit from parent or explicit color classes

#### Common Icons
- **Navigation**: LayoutDashboard, MessageSquare, Upload, Key, AlertTriangle, FileText, Settings
- **Security**: Lock, Shield, Key, Fingerprint
- **Actions**: Plus, Search, Filter, Send, Download, Trash2
- **Status**: CheckCircle, AlertCircle, XCircle, RefreshCw
- **Communication**: Phone, Video, MoreVertical, Bell

---

### **Component Architecture**

#### Folder Structure
```
src/
├── components/
│   ├── ui/          # shadcn/ui primitives (buttons, inputs, cards, etc.)
│   ├── layout/      # AppLayout, Header, Sidebar, BottomNav
│   ├── chat/        # ChatBubble, ChatListItem, MessageInput
│   └── shared/      # StatCard, SecurityAlert, FileCard, KeyStatusBadge
├── pages/           # Route pages (Dashboard, Chats, Conversation, etc.)
├── hooks/           # Custom hooks (use-toast, use-mobile)
└── lib/             # Utilities (utils.ts with cn function)
```

#### Naming Conventions
- **Components**: PascalCase (e.g., `ChatBubble.tsx`)
- **Files**: kebab-case for utilities (e.g., `use-toast.ts`)
- **Props Interfaces**: Component name + Props (e.g., `ChatBubbleProps`)
- **CSS Classes**: Tailwind utility classes, custom utilities in `@layer utilities`

#### Component Patterns
- **Functional Components**: All components are functional
- **TypeScript**: Full type safety with interfaces
- **Props**: Destructured with TypeScript interfaces
- **Styling**: Tailwind classes with `cn()` utility for conditional classes
- **Accessibility**: Radix UI components provide ARIA attributes

---

### **State Management**

#### React Query
- Used for server state management
- QueryClient configured in App.tsx
- Provider wraps entire app

#### Local State
- React hooks (`useState`, `useEffect`)
- Context API (if needed, not shown in sentinel-ui)

---

### **Routing Structure**

#### Routes
- `/` → Index (redirects to `/login`)
- `/login` → Login page
- `/register` → Register page
- `/dashboard` → Dashboard (protected)
- `/chats` → Chat list (protected)
- `/conversation/:id` → Individual conversation (protected)
- `/files` → File management (protected)
- `/keys` → Key management (protected)
- `/alerts` → Security alerts (protected)
- `/logs` → System logs (protected)
- `/settings` → Settings (protected)
- `*` → 404 Not Found

#### Layout Structure
- **Public Routes**: Login, Register, Index (no layout)
- **Protected Routes**: Wrapped in `<AppLayout />` component
- **Nested Routes**: Using React Router's `<Outlet />`

---

### **Accessibility Features**

#### ARIA Support
- Radix UI components provide built-in ARIA attributes
- Proper semantic HTML elements
- Keyboard navigation support

#### Focus Management
- Focus rings on interactive elements
- Focus-visible states
- Tab order management

#### Screen Reader Support
- Alt text for images
- Proper heading hierarchy
- Descriptive button labels

---

### **Responsive Design Patterns**

#### Mobile-First Approach
- Base styles for mobile
- Progressive enhancement for larger screens
- Breakpoint prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`

#### Common Responsive Patterns
- **Padding**: `p-4 sm:p-6 lg:p-8`
- **Grid Columns**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Text Sizes**: `text-lg sm:text-xl lg:text-2xl`
- **Visibility**: `hidden lg:block` (hide on mobile, show on desktop)
- **Layout**: Sidebar hidden on mobile, bottom nav shown

---

### **Custom Utilities**

#### CSS Utilities (in index.css)
- `.glow-primary`, `.glow-success`, `.glow-warning`, `.glow-destructive`
- `.gradient-primary`, `.gradient-card`
- `.text-gradient` (gradient text effect)
- `.glass` (glassmorphism effect)
- `.secure-badge`, `.warning-badge`, `.danger-badge`
- `.scrollbar-thin` (custom scrollbar styling)

#### JavaScript Utilities
- `cn()`: Class name merger (clsx + tailwind-merge)

---

### **Security UI Indicators**

#### Visual Indicators
- **Lock Icons**: Throughout UI to indicate encryption
- **Shield Icons**: Security features
- **Status Badges**: "Encrypted", "Connection Secure"
- **Color Coding**: Success (green) for secure states
- **Banners**: "Messages are end-to-end encrypted" in chat

---

### **Loading States**

#### Patterns
- **Spinner**: Circular border animation
- **Skeleton**: Placeholder content (skeleton component available)
- **Disabled States**: Opacity reduction, pointer-events-none
- **Button Loading**: Spinner icon with text

---

### **Error States**

#### Patterns
- **Error Messages**: Destructive color, clear messaging
- **Alert Components**: SecurityAlert with severity levels
- **Toast Notifications**: Sonner for temporary messages
- **Empty States**: Centered text with muted color

---

### **File Upload UI**

#### Patterns
- **Drag & Drop Zone**: Dashed border, hover states
- **File Cards**: Icon, name, size, encryption indicator
- **Grid/List View**: Toggle between views
- **Storage Stats**: Progress bars, usage indicators

---

### **Key Management UI**

#### Patterns
- **Key Cards**: Status badges, fingerprint display (masked/unmasked)
- **Actions**: Rotate, Export, Delete
- **Generation UI**: Prominent call-to-action
- **Security Notice**: Information banner

---

### **Summary of Design Principles**

1. **Dark Theme First**: All colors optimized for dark backgrounds
2. **Cyan/Teal Primary**: Distinctive brand color (187 85% 53%)
3. **High Contrast**: Clear text/background contrast for readability
4. **Smooth Animations**: Subtle, purposeful animations
5. **Consistent Spacing**: 4px base unit system
6. **Rounded Corners**: Modern, friendly aesthetic
7. **Glassmorphism**: Backdrop blur effects for depth
8. **Security-First**: Encryption indicators throughout
9. **Responsive**: Mobile-first, progressive enhancement
10. **Accessible**: ARIA support, keyboard navigation, focus management

---

## Next Steps

This analysis provides the complete foundation for:
1. **Step 2**: Analyzing current client structure
2. **Step 3**: Building UI matching plan
3. **Step 4**: Applying UI overhaul

