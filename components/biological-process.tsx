import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export type BiologicalProcess = {
  goId: string;
  goName: string;
  genes: string[];
  nbGenes: string;
};

export function BiologicalProcessTable({
  biologicalProcesses,
  ...props
}: { biologicalProcesses: BiologicalProcess[] } & React.ComponentProps<
  typeof Table
>) {
  return (
    <Table {...props}>
      <TableHeader className="text-sm font-bold">
        <TableRow className="border-gray-500">
          <TableHead className="px-0">GO Name</TableHead>
          <TableHead className="px-0">GO ID</TableHead>
          <TableHead className="px-0">Genes</TableHead>
          <TableHead className="px-0">Number of Genes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="text-xs">
        {biologicalProcesses.map((process, index) => (
          <TableRow key={process.goId || index} className="border-gray-300">
            <TableCell className="max-w-40 pl-0 whitespace-normal">
              {process.goName || "Unnamed Process"}
            </TableCell>
            <TableCell className="pl-0">
              {process.goId || "No GO ID listed"}
            </TableCell>
            <TableCell className="pl-0">
              {process.genes.length > 0
                ? process.genes.join(", ")
                : "No genes listed"}
            </TableCell>
            <TableCell className="pl-0">
              {process.nbGenes || "No number of genes listed"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
