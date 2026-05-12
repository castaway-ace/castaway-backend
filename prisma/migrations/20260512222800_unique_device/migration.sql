/*
  Warnings:

  - A unique constraint covering the columns `[name,model]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "devices_name_model_key" ON "devices"("name", "model");
