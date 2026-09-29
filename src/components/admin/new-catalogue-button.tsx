"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CatalogueCreateDialog } from "@/components/admin/catalogue-create-dialog";
import { Button } from "@/components/ui/button";

export function NewCatalogueButton() {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Button onClick={() => setCreating(true)} className="bg-brand text-white hover:bg-brand-hover">
        <Plus /> New catalogue
      </Button>
      {creating && <CatalogueCreateDialog onClose={() => setCreating(false)} />}
    </>
  );
}
