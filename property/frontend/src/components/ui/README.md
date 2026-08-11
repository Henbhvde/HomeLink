# UI component library

```tsx
import { Badge, Button, Card, CardContent, Input, Modal, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui';

<Button variant="primary" loading={false}>Хадгалах</Button>
<Input type="email" placeholder="name@example.mn" />
<Badge tone="success">Төлөгдсөн</Badge>

<Card><CardContent>Card content</CardContent></Card>

<Modal open={open} title="Баталгаажуулах" onClose={() => setOpen(false)}
  footer={<Button onClick={save}>Хадгалах</Button>}>
  Modal content
</Modal>

<Table>
  <TableHeader><TableRow><TableHead>Нэр</TableHead></TableRow></TableHeader>
  <TableBody><TableRow><TableCell>Бат</TableCell></TableRow></TableBody>
</Table>
```

Variants: `Button` — primary/secondary/outline/ghost/danger; `Badge` — neutral/success/warning/danger/info. Design tokens are defined in `styles/index.css` and mapped through Tailwind.
