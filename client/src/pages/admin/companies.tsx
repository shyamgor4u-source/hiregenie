import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, MapPin, Users, Globe } from "lucide-react";

export default function AdminCompanies() {
  const { authFetch } = useAuth();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["/api/admin/companies"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/admin/companies");
      return res.json();
    },
  });

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Companies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">All registered companies</p>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !companies || companies.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No companies registered</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company: any) => (
                    <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {company.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{company.name}</p>
                            {company.website && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" /> {company.website}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.industry ? (
                          <Badge variant="secondary">{company.industry}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {company.location}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.size ? (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {company.size}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppSidebar>
  );
}
