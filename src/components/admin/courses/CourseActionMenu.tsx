import { Link } from "@tanstack/react-router";
import {
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
  GlobeLock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CourseActionMenuProps {
  courseId: string;
  slug: string;
  status: string;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePublish: () => void;
}

export function CourseActionMenu({
  courseId,
  slug,
  status,
  onDelete,
  onDuplicate,
  onTogglePublish,
}: CourseActionMenuProps) {
  const isPublished = status === "published";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Course actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isPublished && (
          <DropdownMenuItem asChild>
            <a href={`/courses/${slug}`} target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              View
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/admin/courses/$courseId/preview" params={{ courseId }}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/courses/$courseId/edit" params={{ courseId }}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onTogglePublish}>
          {isPublished ? (
            <>
              <GlobeLock className="mr-2 h-4 w-4" />
              Unpublish
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" />
              Publish
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
