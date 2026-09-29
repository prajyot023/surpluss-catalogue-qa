import { Boxes, LayoutGrid, MessageSquareText, TrendingDown, TrendingUp, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type DashboardStats = {
  activeCatalogues: number;
  products: number;
  newLeads: number;
  openEnquiries: number;
  leadsLast30: number;
  leadsPrev30: number;
};

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

export function SectionCards({ stats }: { stats: DashboardStats }) {
  const trendPct =
    stats.leadsPrev30 > 0
      ? ((stats.leadsLast30 - stats.leadsPrev30) / stats.leadsPrev30) * 100
      : null;
  const trendingUp = (trendPct ?? 0) >= 0;
  const TrendIcon = trendingUp ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>New leads</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCount(stats.newLeads)}
          </CardTitle>
          {trendPct !== null && (
            <CardAction>
              <Badge variant="outline">
                <TrendIcon />
                {trendingUp ? "+" : ""}
                {trendPct.toFixed(1)}%
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Awaiting first contact <MessageSquareText className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {formatCount(stats.leadsLast30)} enquiries in the last 30 days
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Open enquiries</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCount(stats.openEnquiries)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            In the pipeline <Users className="size-4" />
          </div>
          <div className="text-muted-foreground">New and contacted buyers</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active catalogues</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCount(stats.activeCatalogues)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Published and live <LayoutGrid className="size-4" />
          </div>
          <div className="text-muted-foreground">Visible to buyers right now</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Products listed</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCount(stats.products)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Master records <Boxes className="size-4" />
          </div>
          <div className="text-muted-foreground">Reusable across catalogues</div>
        </CardFooter>
      </Card>
    </div>
  );
}
