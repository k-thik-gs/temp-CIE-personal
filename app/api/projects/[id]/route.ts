import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserById } from "@/lib/auth"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 })
    }

    const user = await getUserById(userId)
    if (!user || user.role !== "FACULTY") {
      return NextResponse.json({ error: "Access denied - Faculty only" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { name, description, enrollment_cap } = body

    // Only allow editing these specific fields
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description  
    if (enrollment_cap !== undefined) updateData.enrollment_cap = enrollment_cap

    // Verify the project belongs to this faculty member
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (existingProject.created_by !== userId) {
      return NextResponse.json({ error: "Access denied - Not your project" }, { status: 403 })
    }

    // Update the project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        project_requests: {
          include: {
            student: {
              include: { user: true }
            }
          }
        },
        submissions: true
      }
    })

    return NextResponse.json({ 
      success: true, 
      project: updatedProject 
    })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Delete related project requests
    await prisma.projectRequest.deleteMany({ where: { project_id: id } })
    // Delete related submissions
    await prisma.projectSubmission.deleteMany({ where: { project_id: id } })
    // Delete the project
    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
} 